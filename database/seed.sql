-- Create n8n database
SELECT 'CREATE DATABASE n8n' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='n8n')\gexec

-- Seed knowledge base with resolved incidents for AI context
INSERT INTO knowledge_base (id,ticket_id,title,description,category,severity,source,ai_tags,resolution_summary,applied_fix,status) VALUES
(gen_random_uuid()::text,'SEED-001','[CI/CD] Deploy failure — api-service on main',
 'Workflow failed on main branch during docker push step. OOM error in build.','DEPLOYMENT','HIGH','GITHUB',
 '["docker","deployment","oom","image-build"]',
 'Cleared Docker layer cache. Increased runner memory to 8GB. Re-triggered workflow.',
 'docker system prune -a && re-trigger pipeline','RESOLVED'),
(gen_random_uuid()::text,'SEED-002','CPU spike on prod k8s — 3 nodes at 95%',
 'CPU utilization > 95% on 3 production nodes. Pod scheduling affected. OOMKilled events.','INFRASTRUCTURE','CRITICAL','MONITORING',
 '["kubernetes","cpu","nodes","oomkilled","production"]',
 'Identified memory leak in worker-service v2.1.4. Rolled back to v2.1.3. Added HPA.',
 'kubectl rollout undo deployment/worker-service -n production','RESOLVED'),
(gen_random_uuid()::text,'SEED-003','PostgreSQL connection pool exhausted',
 'pgbouncer at 100% pool. API returning 503 on all DB-dependent endpoints.','DATABASE','HIGH','MONITORING',
 '["postgresql","connection-pool","pgbouncer","503"]',
 'Increased pgbouncer max_client_conn from 100→250. Added connection timeout in app.',
 'max_client_conn=250 in pgbouncer.ini + PGBOUNCER_POOL_SIZE=50 env var','RESOLVED'),
(gen_random_uuid()::text,'SEED-004','SSL cert expired — api.company.com',
 'SSL certificate expired. All HTTPS traffic returning NET::ERR_CERT_DATE_INVALID.','SECURITY','CRITICAL','MONITORING',
 '["ssl","certificate","tls","expiry","security"]',
 'Renewed cert via cert-manager. Added 30d expiry alert to Datadog.',
 'kubectl annotate cert api-tls cert-manager.io/force-renew=true -n default','RESOLVED'),
(gen_random_uuid()::text,'SEED-005','High latency p99 > 3s on payment-service',
 'Payment service p99 latency spiked from 200ms to 3s. No error increase but UX degraded.','PERFORMANCE','HIGH','MONITORING',
 '["latency","performance","payment","p99","redis"]',
 'Found Redis connection leak in payment-service. Patched connection pooling. Deployed v1.8.2.',
 'Update redis pool: max_connections=20, socket_keepalive=True','RESOLVED')
ON CONFLICT DO NOTHING;
