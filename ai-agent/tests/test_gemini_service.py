"""Testes de gemini_service.py — integração com o SDK google-genai.

Nunca chama a API real: `genai.Client` é mockado por completo. Cobre o caso
real já visto em produção — cota esgotada (HTTP 429 RESOURCE_EXHAUSTED via
google.genai.errors.ClientError) — para os três métodos que chamam o SDK.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai import errors as genai_errors

from services.gemini_service import GeminiError, GeminiService


def _quota_exhausted_error() -> genai_errors.ClientError:
    """Reproduz o erro real de cota esgotada (429 RESOURCE_EXHAUSTED) visto em produção."""
    return genai_errors.ClientError(
        429,
        {
            "error": {
                "code": 429,
                "message": "Quota exceeded",
                "status": "RESOURCE_EXHAUSTED",
            }
        },
    )


@pytest.fixture
def gemini_service(mocker):
    # Nunca cria um Client real — evita qualquer chamada de rede/validação de
    # chave durante a suíte.
    mocker.patch("services.gemini_service.genai.Client")
    service = GeminiService(
        api_key="chave-teste",
        model_stt="modelo-stt",
        model_llm="modelo-llm",
        model_tts="modelo-tts",
    )
    return service


def _mock_generate_content(service: GeminiService, return_value=None, side_effect=None):
    service._client.aio.models.generate_content = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )


# --- synthesize_speech --------------------------------------------------------


async def test_synthesize_speech_retorna_pcm_reamostrado_para_8khz(gemini_service, mocker):
    # Arrange — simula resposta do TTS com PCM 24kHz cru
    pcm_24k = b"\x00\x01" * 100
    resposta = MagicMock()
    resposta.candidates[0].content.parts[0].inline_data.data = pcm_24k
    _mock_generate_content(gemini_service, return_value=resposta)
    resample_mock = mocker.patch.object(
        GeminiService, "_resample", return_value=b"pcm-8k-reamostrado"
    )

    # Act
    resultado = await gemini_service.synthesize_speech("texto de teste")

    # Assert
    assert resultado == b"pcm-8k-reamostrado"
    resample_mock.assert_called_once_with(pcm_24k, 24000, 8000)


async def test_synthesize_speech_levanta_gemini_error_em_falha_generica(gemini_service):
    # Arrange
    _mock_generate_content(gemini_service, side_effect=RuntimeError("falha de rede"))

    # Act / Assert
    with pytest.raises(GeminiError, match="Falha ao sintetizar fala"):
        await gemini_service.synthesize_speech("texto de teste")


async def test_synthesize_speech_levanta_gemini_error_em_cota_esgotada(gemini_service):
    # Arrange — reproduz o erro real de produção (429 RESOURCE_EXHAUSTED)
    _mock_generate_content(gemini_service, side_effect=_quota_exhausted_error())

    # Act / Assert — a mensagem exposta ao chamador nunca deve conter detalhe
    # cru do provedor (só a mensagem genérica do GeminiError)
    with pytest.raises(GeminiError, match="Falha ao sintetizar fala"):
        await gemini_service.synthesize_speech("texto de teste")


# --- transcribe ----------------------------------------------------------------


async def test_transcribe_retorna_texto_limpo(gemini_service):
    # Arrange
    resposta = MagicMock()
    resposta.text = "  reconhecido, vou tratar agora  "
    _mock_generate_content(gemini_service, return_value=resposta)

    # Act
    resultado = await gemini_service.transcribe(b"\x00\x01" * 50)

    # Assert
    assert resultado == "reconhecido, vou tratar agora"


async def test_transcribe_retorna_string_vazia_quando_texto_e_none(gemini_service):
    # Arrange — SDK pode devolver response.text=None em alguns casos de borda
    resposta = MagicMock()
    resposta.text = None
    _mock_generate_content(gemini_service, return_value=resposta)

    # Act
    resultado = await gemini_service.transcribe(b"\x00" * 10)

    # Assert
    assert resultado == ""


async def test_transcribe_levanta_gemini_error_em_falha_generica(gemini_service):
    # Arrange
    _mock_generate_content(gemini_service, side_effect=RuntimeError("erro do SDK"))

    # Act / Assert
    with pytest.raises(GeminiError, match="Falha ao transcrever"):
        await gemini_service.transcribe(b"\x00" * 10)


async def test_transcribe_levanta_gemini_error_em_cota_esgotada(gemini_service):
    # Arrange — mesmo erro real de produção, agora no caminho de STT
    _mock_generate_content(gemini_service, side_effect=_quota_exhausted_error())

    # Act / Assert
    with pytest.raises(GeminiError, match="Falha ao transcrever"):
        await gemini_service.transcribe(b"\x00" * 10)


# --- classify_response --------------------------------------------------------


async def test_classify_response_retorna_silencio_sem_chamar_llm_para_transcricao_vazia(
    gemini_service,
):
    # Arrange
    mock_generate = AsyncMock()
    gemini_service._client.aio.models.generate_content = mock_generate

    # Act
    resultado = await gemini_service.classify_response("")

    # Assert — atalho documentado: nunca gasta chamada de LLM pra transcrição vazia
    assert resultado == "SILENCIO"
    mock_generate.assert_not_called()


async def test_classify_response_retorna_silencio_para_transcricao_literal_silencio(
    gemini_service,
):
    # Act
    resultado = await gemini_service.classify_response("SILENCIO")

    # Assert
    assert resultado == "SILENCIO"


async def test_classify_response_retorna_reconhecido_quando_llm_classifica_assim(
    gemini_service,
):
    # Arrange
    resposta = MagicMock()
    resposta.text = json.dumps({"classificacao": "RECONHECIDO"})
    _mock_generate_content(gemini_service, return_value=resposta)

    # Act
    resultado = await gemini_service.classify_response("pode deixar, já vou tratar")

    # Assert
    assert resultado == "RECONHECIDO"


async def test_classify_response_retorna_nao_reconhecido_para_categoria_fora_do_enum(
    gemini_service,
):
    # Arrange — defesa em profundidade: mesmo que o schema falhe e o LLM devolva
    # algo fora do enum esperado, o método nunca deve propagar essa categoria.
    resposta = MagicMock()
    resposta.text = json.dumps({"classificacao": "CATEGORIA_INVENTADA"})
    _mock_generate_content(gemini_service, return_value=resposta)

    # Act
    resultado = await gemini_service.classify_response("resposta qualquer")

    # Assert
    assert resultado == "NAO_RECONHECIDO"


async def test_classify_response_retorna_nao_reconhecido_em_falha_generica(gemini_service):
    # Arrange
    _mock_generate_content(gemini_service, side_effect=RuntimeError("erro do SDK"))

    # Act — fail-closed operacional: nunca assume RECONHECIDO se a IA falhar
    resultado = await gemini_service.classify_response("qualquer coisa")

    # Assert
    assert resultado == "NAO_RECONHECIDO"


async def test_classify_response_retorna_nao_reconhecido_em_cota_esgotada(gemini_service):
    # Arrange — mesmo erro real de produção (429), agora no caminho de classificação
    _mock_generate_content(gemini_service, side_effect=_quota_exhausted_error())

    # Act
    resultado = await gemini_service.classify_response("qualquer coisa")

    # Assert
    assert resultado == "NAO_RECONHECIDO"


async def test_classify_response_retorna_nao_reconhecido_quando_json_malformado(
    gemini_service,
):
    # Arrange — SDK devolveu texto que não é JSON válido (violação do próprio schema)
    resposta = MagicMock()
    resposta.text = "isto não é json"
    _mock_generate_content(gemini_service, return_value=resposta)

    # Act
    resultado = await gemini_service.classify_response("resposta qualquer")

    # Assert — cai no except genérico, fail-closed
    assert resultado == "NAO_RECONHECIDO"


# --- _resample -----------------------------------------------------------------


def test_resample_retorna_mesmo_buffer_quando_taxas_iguais():
    # Arrange
    pcm = b"\x01\x02\x03\x04"

    # Act
    resultado = GeminiService._resample(pcm, 8000, 8000)

    # Assert
    assert resultado == pcm


def test_resample_converte_taxa_diferente_usando_audioop():
    # Arrange — 24kHz → 8kHz deve reduzir o volume de dados (downsampling real)
    pcm_24k = (b"\x00\x10" * 240)  # 480 bytes ~ 10ms a 24kHz/16bit/mono

    # Act
    resultado = GeminiService._resample(pcm_24k, 24000, 8000)

    # Assert — downsampling de 24k para 8k reduz o tamanho proporcionalmente
    assert len(resultado) < len(pcm_24k)
    assert len(resultado) > 0
