"use client";

import { FormEvent, useState } from "react";
import { Search, Send } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { apiPost, IS_DEMO_MODE, QueryResponse } from "@/lib/api";

const examples = [
  "Who needs another order right now?",
  "Which SKUs will stock out in the next 30 days?",
  "Which inventory expires soon?",
  "Which customers usually buy SKU 08252K every month?",
  "What should we reorder this week?"
];

function aiModeLabel(result: QueryResponse): string {
  if (result.ai_status === "llm_augmented") return "AI reasoning active";
  if (IS_DEMO_MODE || result.ai_status?.startsWith("demo")) return "Demo rule-based answers";
  if (result.ai_status?.includes("fallback")) return "Safe rule-based fallback";
  return "Safe query mode";
}

function aiSourceLabel(result: QueryResponse): string {
  if (result.ai_status === "llm_augmented" && result.ai?.provider) {
    return `${result.ai.provider} ${result.ai.model}`;
  }
  if (IS_DEMO_MODE || result.ai_status?.startsWith("demo")) {
    return "No live model call in public demo";
  }
  if (result.ai?.configured === false) {
    return "AI key not configured";
  }
  return "Rule-based materialized views";
}

export default function QueryPage() {
  const [question, setQuestion] = useState(examples[0]);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiPost<QueryResponse>("/api/query", { question });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Query</h1>
          <p>Ask about inventory, demand, customers, and replenishment.</p>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            className="textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div className="toolbar">
            {examples.map((example) => (
              <button
                className="button secondary"
                key={example}
                type="button"
                onClick={() => setQuestion(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <button className="button" type="submit" disabled={loading || !question.trim()}>
            {loading ? <Search size={17} /> : <Send size={17} />}
            Run query
          </button>
        </form>
      </section>

      {error ? (
        <section className="panel">
          <div className="message error">{error}</div>
        </section>
      ) : null}

      {result ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{result.template.replaceAll("_", " ")}</h2>
            </div>
          </div>
          <div className="ai-status-row">
            <span className={result.ai_status === "llm_augmented" ? "ai-status-active" : "ai-status-fallback"}>
              {aiModeLabel(result)}
            </span>
            <span>{aiSourceLabel(result)}</span>
            <span>{result.safe_query_mode.replaceAll("_", " ")}</span>
          </div>
          <p>{result.explanation}</p>
          {result.action_summary?.length ? (
            <div className="answer-summary">
              {result.action_summary.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          ) : null}
          {result.ai_confidence_note || result.ai_risk_notes?.length ? (
            <div className="ai-notes">
              {result.ai_confidence_note ? (
                <div>
                  <span>AI confidence</span>
                  <p>{result.ai_confidence_note}</p>
                </div>
              ) : null}
              {result.ai_risk_notes?.length ? (
                <div>
                  <span>Planner review notes</span>
                  <ul>
                    {result.ai_risk_notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <DataTable columns={result.columns} rows={result.rows} emptyLabel="No matching rows" />
        </section>
      ) : null}
    </>
  );
}
