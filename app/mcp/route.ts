import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// Core MCP handler using mcp-handler
const coreHandler = createMcpHandler(
  async (server) => {
    server.tool(
      "httpx",
      "Scans target domains with httpx and returns a ready-to-run CLI command.",
      {
        target: z
          .array(z.string())
          .min(1)
          .describe("List of domains (e.g., example.com) to probe for HTTP/HTTPS services."),
        ports: z
          .array(z.number())
          .optional()
          .describe("Optional ports to scan, e.g., 80,443."),
        probes: z
          .array(z.string())
          .optional()
          .describe(
            "Optional httpx probe flags such as status-code, title, content-length, web-server, tech-detect, favicon, jarm, etc."
          ),
      },
      async ({ target, ports, probes }) => {
        const args: string[] = ["-u", target.join(","), "-silent"];

        if (ports?.length) {
          args.push("-p", ports.join(","));
        }

        if (probes?.length) {
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
                "Run this command locally (httpx must be installed):\n\n" +
                command +
                "\n\nExecution of CLI binaries is not performed on this hosted MCP server; it only builds the command for you.",
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
            "Scans target domains with httpx and outputs the CLI command to run locally.",
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

// Wrapper to normalize Accept header and provide a fallback for clients missing it
const handler = async (req: Request) => {
  const accept = req.headers.get("accept") || "";

  // Fallback path: some clients (including Render MCP tester) omit text/event-stream.
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    if (req.method === "POST") {
      try {
        const body = await req.json();
        const { id, method, params } = body;

        if (method === "initialize") {
          return new Response(JSON.stringify({ ...manualInitialize, id }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
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
            if (probes?.length) probes.forEach((p: string) => cmd.push(`-${p}`));
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
        console.error("Manual fallback error", err);
      }
    }
    // If not handled above, fall through to core handler but patch Accept header
  }

  // Normal path: ensure Accept header includes both values for createMcpHandler
  const headers = new Headers(req.headers);
  headers.set("accept", "application/json, text/event-stream");

  const modifiedRequest = new Request(req.url, {
    method: req.method,
    headers,
    body: req.body,
  });

  return coreHandler(modifiedRequest as any);
};

export { handler as GET, handler as POST, handler as DELETE };
