import {
  TCVN_5738_EDITION,
  TCVN_5738_SOURCE_NAME,
  TCVN_5738_SOURCE_URL,
} from '../../domain/fire-alarm/tcvn-5738-detector-protection-table'

/**
 * Link to the document the TCVN 5738 circles are based on (the full-text
 * reprint the table numbers were read from). Shown beside the coverage-mode
 * control and in the coverage readout of a selected detector.
 */
export function Tcvn5738SourceLink({ testId }: { testId: string }) {
  return (
    <a
      data-testid={testId}
      href={TCVN_5738_SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={`The circle is based on ${TCVN_5738_EDITION}, read from ${TCVN_5738_SOURCE_NAME}`}
      className="text-xs text-blue-700 underline hover:text-blue-900"
    >
      {TCVN_5738_EDITION} text ({TCVN_5738_SOURCE_NAME})
    </a>
  )
}
