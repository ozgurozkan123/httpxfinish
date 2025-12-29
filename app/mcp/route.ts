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
  },
  {
    basePath: "",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: true,
  }
);

// Wrapper to force Accept header to include both application/json and text/event-stream
const handler = async (req: Request) => {
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
