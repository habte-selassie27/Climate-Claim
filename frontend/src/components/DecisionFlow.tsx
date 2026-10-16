import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n";

/**
 * How a decision is reached — the flow from the supplied design spec.
 *
 * WHY HAND-BUILT RATHER THAN MERMAID: rendering mermaid at runtime costs ~2 MB
 * and a runtime layout pass. This is a fixed, known graph with eight nodes, so
 * it is written out directly: no dependency, no layout thrash, and it themes
 * from the same tokens as everything else.
 *
 * ACCESSIBILITY: a decorative arrow glyph is hidden from assistive tech and the
 * whole sequence is also exposed as an ordered list, so the flow is readable by
 * a screen reader in the order it actually happens rather than as eight
 * unlabelled boxes. Colour is never the only signal — every node carries its
 * own text, and the two outcomes are distinguished by wording as well as tone.
 */

interface Node {
  id: string;
  text: MessageKey;
  /** "step" for actions, "decision" for the two questions. */
  kind: "step" | "decision" | "outcome" | "dead";
}

/** The graph, declared once and rendered by position below. */
const NODES: Record<string, Node> = {
  leader: { id: "leader", text: "flow.leader", kind: "step" },
  validators: { id: "validators", text: "flow.validators", kind: "step" },
  equivalent: { id: "equivalent", text: "flow.equivalent", kind: "decision" },
  accepted: { id: "accepted", text: "flow.accepted", kind: "outcome" },
  rejected: { id: "rejected", text: "flow.rejected", kind: "dead" },
  appealed: { id: "appealed", text: "flow.appealed", kind: "decision" },
  finalised: { id: "finalised", text: "flow.finalised", kind: "outcome" },
  settled: { id: "settled", text: "flow.settled", kind: "outcome" },
};

/** Row, column and the edges leaving each node. */
const ROWS: { id: string; col: number; next: string[]; label?: MessageKey }[] = [
  { id: "leader", col: 0, next: ["validators"] },
  { id: "validators", col: 0, next: ["equivalent"] },
  { id: "equivalent", col: 0, next: ["accepted", "rejected"], label: "flow.yes" },
  { id: "accepted", col: 1, next: ["appealed"] },
  { id: "appealed", col: 1, next: ["validators", "finalised"], label: "flow.no" },
  { id: "finalised", col: 1, next: ["settled"] },
  { id: "rejected", col: 0, next: [] },
  { id: "settled", col: 1, next: [] },
];

export function DecisionFlow() {
  const { t } = useI18n();

  return (
    <figure className="flow" data-testid="decision-flow">
      {/* The visual grid. Purely presentational; the list below carries the
          meaning for assistive tech. */}
      <div className="flow-grid" aria-hidden="true">
        {ROWS.map((row) => {
          const node = NODES[row.id]!;
          return (
            <div key={row.id} className={`flow-row flow-col-${row.col}`}>
              <div className={`flow-node flow-node-${node.kind}`}>{t(node.text)}</div>
              {row.next.map((to, i) => (
                <div key={to} className="flow-edge">
                  <span className="flow-arrow" />
                  {row.label && i > 0 ? (
                    <span className="flow-edge-label">{t(row.label)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <figcaption className="visually-hidden">{t("flow.caption")}</figcaption>

      {/* The same sequence as real text, in execution order. */}
      <ol className="flow-steps">
        {ROWS.filter((r) => r.next.length > 0 || r.id === "settled").map((r) => (
          <li key={r.id}>
            <span className={`flow-badge flow-badge-${NODES[r.id]!.kind}`}>
              {t(NODES[r.id]!.text)}
            </span>
            {r.next.length > 0 ? (
              <span className="small muted">
                {" -> "}
                {t("flow.arrowTo")}{" "}
                {r.next.map((n, i) => (
                  <span key={n}>
                    {i > 0 ? ", " : ""}
                    {t(NODES[n]!.text)}
                  </span>
                ))}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}