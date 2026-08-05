import { useState } from 'react'

import type { Project } from '../../domain/project'
import ProjectHoverList from './ProjectHoverList'

type Material = '양극재' | '음극재'

export default function MaterialDonut({
  counts,
  projectsByMaterial,
  onMaterialHover,
  onProjectSelect,
}: {
  counts: Record<Material, number>
  projectsByMaterial: Record<Material, Project[]>
  onMaterialHover: (material: Material | null) => void
  onProjectSelect: (projectId: string) => void
}) {
  const [hoveredMaterial, setHoveredMaterial] = useState<Material | null>(null)

  function selectMaterial(material: Material | null) {
    setHoveredMaterial(material)
    onMaterialHover(material)
  }

  return (
    <div
      className="material-visual"
      onMouseLeave={() => selectMaterial(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          selectMaterial(null)
        }
      }}
    >
      <div className="material-donut" role="group" aria-label="소재별 사업 분포">
        <button
          className="donut-segment donut-segment--cathode"
          type="button"
          onMouseEnter={() => selectMaterial('양극재')}
          onFocus={() => selectMaterial('양극재')}
        >
          양극재({counts.양극재}건)
        </button>
        <div className="donut-center" aria-hidden="true">
          <strong>{counts.양극재 + counts.음극재}</strong>
          <span>전체 사업</span>
        </div>
        <button
          className="donut-segment donut-segment--anode"
          type="button"
          onMouseEnter={() => selectMaterial('음극재')}
          onFocus={() => selectMaterial('음극재')}
        >
          음극재({counts.음극재}건)
        </button>
      </div>

      {hoveredMaterial && (
        <ProjectHoverList
          material={hoveredMaterial}
          projects={projectsByMaterial[hoveredMaterial]}
          onProjectSelect={onProjectSelect}
        />
      )}
    </div>
  )
}
