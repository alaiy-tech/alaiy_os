import { ErrorBoundary } from "./error-boundary";
import { AnswerChart, ChartFallback } from "./answer-chart";
import { splitAnswer } from "./markdown";

/** One assistant reply: markdown prose, with any charts drawn where the
 * model put them. Each chart is wrapped individually, so a spec that makes
 * Recharts throw costs the reader that one chart and nothing else. */
export function AnswerBody({ text }: { text: string }) {
  return (
    <>
      {splitAnswer(text).map((segment, index) =>
        segment.kind === "prose" ? (
          <div key={index} className="ask-alaiy-answer" dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : (
          <ErrorBoundary key={index} fallback={<ChartFallback raw={segment.raw} />}>
            <AnswerChart raw={segment.raw} />
          </ErrorBoundary>
        ),
      )}
    </>
  );
}
