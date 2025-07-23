FROM alpine:3.21

# Install kubectl and jq
RUN apk add --no-cache \
    curl \
    jq \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Copy the shutdown script
COPY shutdown-namespaces.sh /usr/local/bin/shutdown-namespaces.sh
RUN chmod +x /usr/local/bin/shutdown-namespaces.sh

# Run as non-root user
RUN adduser -D -s /bin/sh kube-esg
USER kube-esg

ENTRYPOINT ["/usr/local/bin/shutdown-namespaces.sh"]