import type { DiagramData } from '@/domain/valueObjects/Diagram'
import { ComparisonDiagram } from './ComparisonDiagram'
import { ConfigDiagram } from './ConfigDiagram'
import { CycleDiagram } from './CycleDiagram'
import { FlowDiagram } from './FlowDiagram'
import { FormulaDiagram } from './FormulaDiagram'
import { HierarchyDiagram } from './HierarchyDiagram'
import { KeyboardDiagram } from './KeyboardDiagram'
import { LayerDiagram } from './LayerDiagram'
import { MatrixDiagram } from './MatrixDiagram'
import { NetworkDiagram } from './NetworkDiagram'
import { SequenceDiagram } from './SequenceDiagram'
import { SwimlaneDiagram } from './SwimlaneDiagram'
import { TerminalDiagram } from './TerminalDiagram'
import { TreeDiagram } from './TreeDiagram'
import { VennDiagram } from './VennDiagram'

function SingleDiagram({ diagram }: { diagram: DiagramData }) {
  switch (diagram.type) {
    case 'hierarchy':
      return <HierarchyDiagram label={diagram.label} items={diagram.items} />
    case 'flow':
      return <FlowDiagram label={diagram.label} steps={diagram.steps} />
    case 'cycle':
      return <CycleDiagram label={diagram.label} trigger={diagram.trigger} states={diagram.states} />
    case 'comparison':
      return <ComparisonDiagram label={diagram.label} columns={diagram.columns} />
    case 'terminal':
      return <TerminalDiagram label={diagram.label} lines={diagram.lines} />
    case 'config':
      return <ConfigDiagram label={diagram.label} filepath={diagram.filepath} lines={diagram.lines} />
    case 'network':
      return <NetworkDiagram label={diagram.label} nodes={diagram.nodes} edges={diagram.edges} />
    case 'sequence':
      return <SequenceDiagram label={diagram.label} actors={diagram.actors} messages={diagram.messages} />
    case 'layer':
      return <LayerDiagram label={diagram.label} layers={diagram.layers} />
    case 'swimlane':
      return <SwimlaneDiagram label={diagram.label} lanes={diagram.lanes} totalSteps={diagram.totalSteps} />
    case 'venn':
      return <VennDiagram label={diagram.label} sets={diagram.sets} intersectionLabel={diagram.intersectionLabel} />
    case 'matrix':
      return (
        <MatrixDiagram
          label={diagram.label}
          rowHeader={diagram.rowHeader}
          colHeader={diagram.colHeader}
          rows={diagram.rows}
          cols={diagram.cols}
          cells={diagram.cells}
        />
      )
    case 'tree':
      return <TreeDiagram label={diagram.label} root={diagram.root} />
    case 'formula':
      return (
        <FormulaDiagram
          label={diagram.label}
          result={diagram.result}
          components={diagram.components}
          operator={diagram.operator}
        />
      )
    case 'keyboard':
      return (
        <KeyboardDiagram
          label={diagram.label}
          combos={diagram.combos}
          sequence={diagram.sequence}
          caption={diagram.caption}
        />
      )
    default:
      return null
  }
}

interface DiagramRendererProps {
  diagrams: readonly DiagramData[]
}

export function DiagramRenderer({ diagrams }: DiagramRendererProps) {
  const items = diagrams
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      {items.map((d, i) => (
        <SingleDiagram key={i} diagram={d} />
      ))}
    </div>
  )
}
