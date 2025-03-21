import {
  AssistantStreamChunk,
  AssistantStreamChunkType,
} from "./AssistantStreamChunkType";
import { StreamPart } from "./utils/StreamPart";
import { ToolResultStreamPart } from "./toolResultStream";

export function assistantEncoderStream() {
  const toolCalls = new Set<string>();
  return new TransformStream<
    ToolResultStreamPart,
    StreamPart<AssistantStreamChunk>
  >({
    transform(chunk, controller) {
      const chunkType = chunk.type;
      switch (chunkType) {
        case "reasoning": {
          controller.enqueue({
            type: AssistantStreamChunkType.ReasoningDelta,
            value: chunk.textDelta,
          });
          break;
        }

        case "source":
          controller.enqueue({
            type: AssistantStreamChunkType.Source,
            value: chunk.source,
          });
          break;

        case "text-delta": {
          if (!chunk.textDelta) break; // ignore empty text deltas
          controller.enqueue({
            type: AssistantStreamChunkType.TextDelta,
            value: chunk.textDelta,
          });
          break;
        }
        case "tool-call-delta": {
          if (!toolCalls.has(chunk.toolCallId)) {
            toolCalls.add(chunk.toolCallId);
            controller.enqueue({
              type: AssistantStreamChunkType.ToolCallBegin,
              value: {
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
              },
            });
          }

          controller.enqueue({
            type: AssistantStreamChunkType.ToolCallDelta,
            value: {
              toolCallId: chunk.toolCallId,
              argsTextDelta: chunk.argsTextDelta,
            },
          });
          break;
        }

        case "annotations": {
          controller.enqueue({
            type: AssistantStreamChunkType.Annotation,
            value: chunk.annotations,
          });
          break;
        }

        case "data": {
          controller.enqueue({
            type: AssistantStreamChunkType.Data,
            value: chunk.data,
          });
          break;
        }

        // ignore
        case "tool-call":
        case "response-metadata":
          break;

        case "tool-result": {
          controller.enqueue({
            type: AssistantStreamChunkType.ToolCallResult,
            value: {
              toolCallId: chunk.toolCallId,
              result: chunk.result,
            },
          });
          break;
        }

        case "step-finish": {
          const { type, ...rest } = chunk;
          controller.enqueue({
            type: AssistantStreamChunkType.FinishStep,
            value: rest,
          });
          break;
        }

        case "finish": {
          const { type, ...rest } = chunk;
          controller.enqueue({
            type: AssistantStreamChunkType.FinishMessage,
            value: rest,
          });
          break;
        }

        case "error": {
          controller.enqueue({
            type: AssistantStreamChunkType.Error,
            value: chunk.error,
          });
          break;
        }
        default: {
          const unhandledType: never = chunkType;
          throw new Error(`Unhandled chunk type: ${unhandledType}`);
        }
      }
    },
  });
}
