# =============================================================
# Frontend Dockerfile — AgentIA
# =============================================================

# ---------- Stage 1: Build do React ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ .

ARG VITE_API_URL=https://agentia.voiphash.com.br/api/v1
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_ASTERISK_WS=wss://agentia.voiphash.com.br/asterisk-ws
ENV VITE_ASTERISK_WS=$VITE_ASTERISK_WS

ARG VITE_SIP_URI=sip:9001@agentia.voiphash.com.br
ENV VITE_SIP_URI=$VITE_SIP_URI

ARG VITE_SIP_PASSWORD=webrtc9001pass
ENV VITE_SIP_PASSWORD=$VITE_SIP_PASSWORD

ARG VITE_STUN_URL=stun:stun.l.google.com:19302
ENV VITE_STUN_URL=$VITE_STUN_URL

ARG VITE_TURN_URL=
ENV VITE_TURN_URL=$VITE_TURN_URL

ARG VITE_TURN_USER=asteriskia
ENV VITE_TURN_USER=$VITE_TURN_USER

ARG VITE_TURN_CREDENTIAL=
ENV VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL

RUN npm run build

# ---------- Stage 2: Nginx ----------
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html \
    && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
