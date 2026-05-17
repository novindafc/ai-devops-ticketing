# AI-Powered Enterprise DevOps Ticketing Platform

## Overview

This project is an enterprise-style incident management platform that combines AI analysis, DevOps automation, and multi-source ticket ingestion.

### Supported trigger sources

* GitHub CI/CD webhook failures
* Google Sheets (manual ticketing from Google Forms)
* Monitoring alerts (Prometheus/Grafana webhooks)

### Features

* Data cleaning and normalization
* Missing data handling
* AI incident analysis (summary, severity score, root cause hypothesis, recommended action)
* Human approval before rollback
* Retry and escalation logic
* Jira issue creation
* Slack notification
* Incident status tracking
* Knowledge base for similar historical incidents
* React dashboard with simulation tools

---

## Project structure

```text
ai-devops-platform/
├── README.md
├── docker-compose.yml
├── .env.example
├── backend-fastapi/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── incidents.py
│   │   │       ├── deployment.py
│   │   │       └── simulation.py
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── schemas/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend-react/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   ├── package.json
│   └── Dockerfile
├── n8n-workflows/
│   └── valid_n8n_workflow_export_fixed.json
└── docs/
    ├── architecture.md
    └── credentials-setup.md
```

---

## docker-compose.yml

```yaml
version: '3.9'
services:
  backend:
    build: ./backend-fastapi
    ports:
      - "8000:8000"
    env_file:
      - .env

  frontend:
    build: ./frontend-react
    ports:
      - "5173:5173"

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: incidents
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - ./n8n_data:/home/node/.n8n
```

---

## .env.example

```env
OPENAI_API_KEY=your_key
POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/incidents
SLACK_BOT_TOKEN=your_slack_token
JIRA_API_TOKEN=your_jira_token
DEPLOYMENT_API_TOKEN=internal_token
```

---

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Services:

* Backend: [http://localhost:8000/docs](http://localhost:8000/docs)
* Frontend: [http://localhost:5173](http://localhost:5173)
* n8n: [http://localhost:5678](http://localhost:5678)

---

## Credential setup

### n8n nodes needing credentials

1. Google Sheets Trigger
2. Slack node
3. Jira node
4. PostgreSQL node
5. HTTP Request node (internal API auth header)

### No credential required

* GitHub webhook trigger
* monitoring webhook
* merge/set/code nodes

---

## Demo simulation

Use frontend simulator page:

* simulate CI/CD failure
* simulate manual ticket
* simulate monitoring alert

---

## Portfolio summary

This project demonstrates:

* FastAPI backend design
* React dashboard development
* n8n enterprise workflow automation
* AI incident analysis
* PostgreSQL persistence
* DevOps incident response
