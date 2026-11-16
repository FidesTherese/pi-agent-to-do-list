import { createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools, type AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Register a scripted local model and return no value.
 *
 * The model checks that Pi sends the task instructions and tool, then issues
 * two predetermined task updates before returning a short answer. It makes no
 * network requests. It checks how Pi loads the extension and runs its tool.
 *
 * :param pi: ExtensionAPI; Pi's provider registration interface.
 * return None: void; no value is returned.
 */
export default function registerFakeModel(pi: ExtensionAPI): void {
  pi.registerProvider("task-test", {
    api: "task-test-api",
    baseUrl: "http://127.0.0.1",
    apiKey: "test",
    models: [{
      id: "task-test",
      name: "Scripted task test",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 16000,
      maxTokens: 1000,
    }],
    /**
     * Produce one scripted model response and return its event stream.
     *
     * The model supplies `api`, `provider`, and `id` strings. The context has
     * an ordered `messages` array containing Pi's system messages and any
     * earlier tool results; a task tool result identifies itself with
     * `role: "toolResult"` and `toolName: "set_tasks"`. The stream contains
     * either one task tool call or a final text response. No input is changed.
     *
     * :param model: Model<Api>; model identity supplied by Pi.
     * :param context: TranscriptContext; current ordered conversation messages.
     * return stream: AssistantMessageEventStream; scripted response events.
     */
    streamSimple: (model, context) => {
      const stream = createAssistantMessageEventStream();
      const results = context.messages.filter((message) => message.role === "toolResult" && message.toolName === "set_tasks");
      const instructionsPresent = getCurrentSystemPrompt(context.messages).includes("set_tasks") &&
        getCurrentTools(context.messages).some((tool) => tool.name === "set_tasks");
      const output: AssistantMessage = {
        role: "assistant",
        content: [],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: instructionsPresent && results.length < 2 ? "toolUse" : "stop",
        timestamp: Date.now(),
      };
      stream.push({ type: "start", partial: output });
      if (instructionsPresent && results.length < 2) {
        const toolCall = {
          type: "toolCall" as const,
          id: `task-${results.length}`,
          name: "set_tasks",
          arguments: { tasks: [{ description: "Check the request", status: results.length === 0 ? "in_progress" : "completed" }] },
        };
        output.content.push(toolCall);
        stream.push({ type: "toolcall_start", contentIndex: 0, partial: output });
        stream.push({ type: "toolcall_end", contentIndex: 0, toolCall, partial: output });
      } else {
        const text = instructionsPresent ? "The scripted check finished." : "Task instructions or tool were missing.";
        output.content.push({ type: "text", text });
        stream.push({ type: "text_start", contentIndex: 0, partial: output });
        stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: output });
        stream.push({ type: "text_end", contentIndex: 0, content: text, partial: output });
      }
      stream.push({ type: "done", reason: output.stopReason as "stop" | "toolUse", message: output });
      stream.end();
      return stream;
    },
  });
}
