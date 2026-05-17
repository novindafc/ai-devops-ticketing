// Mock Kubernetes Deployment API — Local Development
// Simulates the internal gateway that n8n → FastAPI calls for rollbacks

const http = require("http");
const log = (m) => console.log(`[k8s-mock] ${new Date().toISOString()} ${m}`);

http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    const url = req.url || "";

    if (req.method === "POST" && url === "/v1/deployments/rollback") {
      let p = {}; try { p = JSON.parse(body); } catch {}
      log(`ROLLBACK: ${p.deployment}@${p.namespace} cluster=${p.cluster} dry=${p.dry_run}`);
      log(`  Ticket: ${p.audit?.ticket_id} | Reason: ${p.audit?.reason}`);
      const success = Math.random() > 0.15; // 85% success rate
      const revision = `rev-${Math.floor(Math.random()*200)}`;
      setTimeout(() => {
        res.writeHead(success ? 200 : 500);
        res.end(JSON.stringify({
          success, deployment: p.deployment, namespace: p.namespace, cluster: p.cluster,
          revision, message: success ? `Rolled back to ${revision}` : "Rollback failed: ImagePullBackOff on previous image",
          executed_at: new Date().toISOString(), dry_run: p.dry_run
        }));
      }, 1500);

    } else if (req.method === "GET" && url.startsWith("/v1/deployments")) {
      const deployments = ["api-service","auth-service","frontend","worker","payments"].map(name => ({
        name, namespace: "production", replicas: Math.floor(Math.random()*5)+1,
        ready: Math.floor(Math.random()*5), image: `company/${name}:v${Math.floor(Math.random()*50)+1}.0.0`,
        revision: `rev-${Math.floor(Math.random()*200)}`, updated_at: new Date().toISOString()
      }));
      res.writeHead(200); res.end(JSON.stringify({ deployments, total: deployments.length }));

    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: "Not found", path: url }));
    }
  });
}).listen(9090, () => log("Mock K8s Deployment API on :9090 — 85% success rate"));
