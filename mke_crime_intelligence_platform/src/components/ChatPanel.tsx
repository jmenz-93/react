import { useState } from "react";
import { ChevronDown, ChevronRight, Send, Trash2 } from "lucide-react";
import { askCrimeAssistantWithTools } from "../lib/chat";
import type { ApiConfig, ChatMessage, CrimeAnalytics, CrimeRecord, MapFocus } from "../lib/types";

interface ChatPanelProps {
  analytics: CrimeAnalytics | null;
  records: CrimeRecord[];
  apiConfig: ApiConfig;
  onApiConfigChange: (config: ApiConfig) => void;
  /** Invoked when the assistant emits a map zoom instruction. */
  onMapFocus?: (focus: MapFocus) => void;
  /** When true, render chat content without the outer panel/header wrapper. */
  embedded?: boolean;
}

export function ChatPanel(props: Readonly<ChatPanelProps>): JSX.Element {
  const { analytics, records, apiConfig, onApiConfigChange, onMapFocus, embedded = false } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const hasApiKey = Boolean(apiConfig.apiKey?.trim());
  const [showApiConfig, setShowApiConfig] = useState(!hasApiKey);

  const send = async (questionOverride?: string): Promise<void> => {
    const question = (questionOverride ?? input).trim();
    if (!analytics || !question || isThinking || !hasApiKey) {
      return;
    }

    if (!questionOverride) setInput("");
    const nextMessages = [...messages, { role: "user", content: question } as ChatMessage];
    setMessages(nextMessages);
    setIsThinking(true);

    const reply = await askCrimeAssistantWithTools({
      question,
      history: nextMessages,
      analytics,
      records,
      apiConfig,
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: reply.answer,
        suggestions: reply.suggestions,
        internalMessages: reply.internalMessages,
      },
    ]);
    if (reply.mapFocus && onMapFocus) {
      onMapFocus(reply.mapFocus);
    }
    setIsThinking(false);
  };

  const inner = (
    <>
      {embedded ? null : (
        <header className="panel-header">
          <h2>Crime Analyst</h2>
          <p>Ask about patterns, hotspots, and tactical recommendations.</p>
        </header>
      )}

      <div className="chat-toolbar">
        <button
          type="button"
          className="api-toggle"
          onClick={() => setShowApiConfig((prev) => !prev)}
        >
          {showApiConfig ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          API Settings
        </button>
        <button
          type="button"
          className="chat-clear"
          onClick={() => {
            if (messages.length === 0) return;
            const ok = window.confirm(
              "Clear this conversation and start a new one? This can't be undone.",
            );
            if (ok) setMessages([]);
          }}
          disabled={messages.length === 0 || isThinking}
          title="Clear conversation and start a new one"
          aria-label="New conversation"
        >
          <Trash2 size={14} />
          New conversation
        </button>
      </div>

      {showApiConfig ? (
        <div className="api-config">
          <input
            type="password"
            placeholder="OpenAI API key (required)"
            value={apiConfig.apiKey}
            onChange={(event) => onApiConfigChange({ ...apiConfig, apiKey: event.target.value })}
          />
          <div className="api-row">
            <input
              type="text"
              placeholder="Base URL"
              value={apiConfig.baseUrl}
              onChange={(event) => onApiConfigChange({ ...apiConfig, baseUrl: event.target.value })}
            />
            <input
              type="text"
              placeholder="Model"
              value={apiConfig.model}
              onChange={(event) => onApiConfigChange({ ...apiConfig, model: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="chat-log">
        {messages.length === 0 ? (
          <p className="muted">
            Try: "What's crime like near 27th & Oklahoma?", "What's happening in 53202?", or "What tactics could reduce burglaries?"
          </p>
        ) : (
          messages.map((message, idx) => {
            const isLatestAssistant =
              message.role === "assistant" && idx === messages.length - 1;
            const showChips =
              isLatestAssistant &&
              !isThinking &&
              Array.isArray(message.suggestions) &&
              message.suggestions.length > 0;
            return (
              <article key={`${message.role}-${idx}`} className={`bubble ${message.role}`}>
                <h4>{message.role === "user" ? "You" : "Assistant"}</h4>
                <p>{message.content}</p>
                {showChips ? (
                  <div className="followup-chips" role="group" aria-label="Suggested follow-up questions">
                    {message.suggestions!.map((q, qi) => (
                      <button
                        key={qi}
                        type="button"
                        className="followup-chip"
                        onClick={() => void send(q)}
                        disabled={isThinking}
                        title={q}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}

        {isThinking ? <p className="muted">Thinking through trend context...</p> : null}
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            !analytics
              ? "Upload a CSV to begin..."
              : !hasApiKey
              ? "Add an OpenAI API key in API Settings to begin..."
              : "Ask a question about the data..."
          }
          disabled={!analytics || !hasApiKey}
          rows={3}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!analytics || !hasApiKey || !input.trim() || isThinking}
        >
          <Send size={16} />
          Send
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="chat-panel embedded">{inner}</div>;
  }
  return <section className="panel chat-panel">{inner}</section>;
}
