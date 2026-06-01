"use client";

import { FormEvent, useState } from "react";
import { Search, Send } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { apiPost, QueryResponse } from "@/lib/api";

const examples = [
  "Who needs another order right now?",
  "Which SKUs will stock out in the next 30 days?",
  "Which inventory expires soon?",
  "Which customers usually buy SKU OTG-RAM-001 every month?",
  "What should we reorder this week?"
];

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
          <h1>Natural-Language Query</h1>
          <p>Planner questions over structured data, with safe templates instead of unrestricted SQL.</p>
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
              <p>{result.explanation}</p>
            </div>
          </div>
          <DataTable columns={result.columns} rows={result.rows} emptyLabel="No matching rows" />
          <p>Mode: {result.safe_query_mode}</p>
        </section>
      ) : null}
    </>
  );
}
