FROM python:3-alpine

RUN apk add --no-cache openssl

COPY serve.py /app/serve.py
COPY tls_proxy.py /app/tls_proxy.py

EXPOSE 8080 8443 8444 8445

CMD ["python3", "/app/serve.py"]
