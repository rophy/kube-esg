# Kubernetes ESG Dashboard Makefile

# Configuration
APP_NAME := kube-esg-app
SHUTDOWN_JOB_NAME := shutdown-job
VERSION := latest
REGISTRY ?= local

# Skaffold targets
.PHONY: dev
dev: ## Start development environment with hot reload
	skaffold dev --port-forward --tail

.PHONY: run
run: ## Deploy application to cluster
	skaffold run --port-forward --tail

.PHONY: deploy
deploy: run ## Alias for run

.PHONY: delete
delete: ## Delete application from cluster
	skaffold delete

.PHONY: clean
clean: delete ## Alias for delete

# Build targets
.PHONY: build
build: build-app ## Build Docker image

.PHONY: build-app
build-app: ## Build main application Docker image (includes shutdown job)
	docker build -t $(APP_NAME):$(VERSION) .

# Development targets
.PHONY: install
install: ## Install npm dependencies
	npm install

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: test
test: ## Run tests
	npm test

.PHONY: build-next
build-next: ## Build Next.js application
	npm run build

# Kind cluster targets
.PHONY: kind-load
kind-load: build ## Build and load images into kind cluster
	kind load docker-image $(APP_NAME):$(VERSION)

.PHONY: kind-deploy
kind-deploy: kind-load run ## Build, load images to kind, and deploy

# Kubernetes targets
.PHONY: apply-manifests
apply-manifests: ## Apply Kubernetes manifests directly
	kubectl apply -f deploy/

.PHONY: delete-manifests
delete-manifests: ## Delete Kubernetes manifests
	kubectl delete -f deploy/ --ignore-not-found

# Port forwarding
.PHONY: port-forward
port-forward: ## Port forward to application service
	kubectl port-forward -n kube-esg service/kube-esg-app 3000:3000

.PHONY: port-forward-dex
port-forward-dex: ## Port forward to Dex service
	kubectl port-forward -n kube-esg service/dex 5556:5556

# Logs
.PHONY: logs
logs: ## Show application logs
	kubectl logs -n kube-esg -l app=kube-esg-app -f

.PHONY: logs-dex
logs-dex: ## Show Dex logs
	kubectl logs -n kube-esg -l app=dex -f

# Status
.PHONY: status
status: ## Show deployment status
	kubectl get pods,services,deployments -n kube-esg

.PHONY: describe
describe: ## Describe application resources
	kubectl describe deployment/kube-esg-app -n kube-esg
	kubectl describe service/kube-esg-app -n kube-esg

# Database/Cleanup
.PHONY: restart
restart: ## Restart application deployment
	kubectl rollout restart deployment/kube-esg-app -n kube-esg

# Shutdown job targets
.PHONY: run-shutdown-job
run-shutdown-job: ## Run shutdown job once
	kubectl create job --from=cronjob/shutdown-job shutdown-job-manual -n kube-esg || \
	kubectl delete job shutdown-job-manual -n kube-esg && \
	kubectl create job --from=cronjob/shutdown-job shutdown-job-manual -n kube-esg

.PHONY: logs-shutdown-job
logs-shutdown-job: ## Show shutdown job logs
	kubectl logs -n kube-esg -l job-name=shutdown-job-manual -f

# Development utilities
.PHONY: shell-app
shell-app: ## Get shell in app pod
	kubectl exec -it -n kube-esg deployment/kube-esg-app -- /bin/sh

.PHONY: shell-shutdown-job
shell-shutdown-job: ## Run shutdown job in app container with shell
	docker run --rm -it --entrypoint=/bin/sh $(APP_NAME):$(VERSION)

# Test environment
.PHONY: setup-test-env
setup-test-env: ## Set up test namespaces and enable label filtering
	./scripts/setup-test-env.sh

.PHONY: cleanup-test-env
cleanup-test-env: ## Clean up test namespaces and disable label filtering
	./scripts/cleanup-test-env.sh

# Help
.PHONY: help
help: ## Show this help message
	@echo "Kubernetes ESG Dashboard - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:"
	@echo "  make dev          # Start development with hot reload"
	@echo "  make run          # Deploy to cluster"
	@echo "  make status       # Check deployment status"
	@echo "  make delete       # Clean up deployment"

.DEFAULT_GOAL := help