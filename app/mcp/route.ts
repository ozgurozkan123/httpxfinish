import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const baseHandler = createMcpHandler(
  async (server) => {
    server.tool(
      "httpx",
      "Scans target domains and detects active HTTP/HTTPS services using httpx.",
      {
        target: z
          .array(z.string())
          .min(1)
          .describe(
            "A list of domains (e.g., example.com) to scan for HTTP and HTTPS services."
          ),
        ports: z
          .array(z.number())
          .optional()
          .describe("Optional list of ports to scan, e.g., 80,443."),
        probes: z
          .array(z.string())
          .optional()
          .describe(
            "httpx probe flags, e.g., status-code, title, content-length, web-server, tech-detect, favicon, jarm, etc."
          ),
      },
      async ({ target, ports, probes }) => {
        const args: string[] = ["-u", target.join(","), "-silent"];

        if (ports && ports.length > 0) {
          args.push("-p", ports.join(","));
        }

        if (probes && probes.length > 0) {
          for (const probe of probes) {
            args.push(`-${probe}`);
          }
        }

        const command = `httpx ${args.join(" ")}`;

        return {
          content: [
            {
              type: "text",
              text:
                "Run this command locally (or in an environment with httpx installed):\n\n" +
                command +
                "\n\nThis server builds the command; execution of CLI binaries isn't performed in the hosted environment.",
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        httpx: {
          description:
            "Scans target domains with httpx and lists active HTTP/HTTPS services. Returns a ready-to-run command string.",
        },
      },
    },
  } as any,
  {
    basePath: "",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: true,
  }
);

const manualInitialize = {
  jsonrpc: "2.0",
  result: {
    protocolVersion: "2025-03-26",
    capabilities: {
      tools: { listChanged: true },
    },
    serverInfo: {
      name: "httpxfinish",
      version: "1.0.0",
    },
  },
};

const handler = async (req: Request) => {
  const accept = req.headers.get("accept") || "";
  console.log("Incoming Accept header:", accept);
  // Minimal manual MCP responses to bypass strict accept checks
  if (req.method === "POST") {
    try {
      const bodyText = await req.text();
      const data = JSON.parse(bodyText);
      const { id, method, params } = data;

      if (method === "initialize") {
        return new Response(
          JSON.stringify({ ...manualInitialize, id }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (method === "tools/list") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
                {
                  name: "httpx",
                  description:
                    "Scans target domains with httpx and lists active HTTP/HTTPS services.",
                  inputSchema: {
                    type: "object",
                    properties: {
                      target: { type: "array", items: { type: "string" } },
                      ports: { type: "array", items: { type: "number" } },
                      probes: { type: "array", items: { type: "string" } },
                    },
                    required: ["target"],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (method === "tools/call") {
        const { name, arguments: args = {} } = params || {};
        if (name === "httpx") {
          const targets: string[] = args.target || [];
          const ports: number[] | undefined = args.ports;
          const probes: string[] | undefined = args.probes;
          if (!targets || targets.length === 0) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: "target is required" },
              }),
              { status: 400, headers: { "content-type": "application/json" } }
            );
          }
          const cmd: string[] = ["-u", targets.join(","), "-silent"];
          if (ports?.length) cmd.push("-p", ports.join(","));
          if (probes?.length) probes.forEach((p) => cmd.push(`-${p}`));
          const command = `httpx ${cmd.join(" ")}`;
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Run this command locally (httpx must be installed):\n${command}`,
                  },
                ],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
      }
    } catch (err) {
      console.error("manual handler parse error", err);
    }
  }

  const headers = new Headers(req.headers);
  if (!accept.includes("text/event-stream")) {
    headers.set("accept", "application/json, text/event-stream");
  }
  const cloned = req.clone();
  const modified = new Request(req.url, {
    method: req.method,
    headers,
    body: cloned.body,
  });
  return baseHandler(modified as any);
};

export { handler as GET, handler as POST, handler as DELETE };
