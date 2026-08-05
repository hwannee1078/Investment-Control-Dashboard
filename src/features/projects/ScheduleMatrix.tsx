import { PROJECT_STAGES, type Project } from '../../domain/project'

export default function ScheduleMatrix({
  project,
  editable,
  onChange,
}: {
  project: Project
  editable: boolean
  onChange?: (schedule: Project['schedule']) => void
}) {
  function updateDate(
    stage: (typeof PROJECT_STAGES)[number],
    field: 'plan' | 'actual',
    value: string,
  ) {
    onChange?.({
      ...project.schedule,
      [stage]: {
        ...project.schedule[stage],
        [field]: value === '' ? null : value,
      },
    })
  }

  return (
    <div className="table-scroll">
      <table className="schedule-matrix" aria-label="사업 일정">
        <thead>
          <tr>
            <th scope="col">구분</th>
            {PROJECT_STAGES.map((stage) => (
              <th key={stage} scope="col">
                {stage}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['계획일', 'plan'],
              ['실적일', 'actual'],
            ] as const
          ).map(([label, field]) => (
            <tr key={field}>
              <th scope="row">{label}</th>
              {PROJECT_STAGES.map((stage) => (
                <td key={stage}>
                  {editable ? (
                    <input
                      type="date"
                      aria-label={`${stage} ${label}`}
                      value={project.schedule[stage][field] ?? ''}
                      onChange={(event) => updateDate(stage, field, event.target.value)}
                    />
                  ) : (
                    project.schedule[stage][field] ?? '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
