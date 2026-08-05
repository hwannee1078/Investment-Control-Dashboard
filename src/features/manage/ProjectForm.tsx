import { useMemo, useState, type FormEvent } from 'react'

import {
  PROJECT_STAGES,
  type Project,
  type ProjectSchedule,
  type ProjectStage,
} from '../../domain/project'

type ProjectFormProps = {
  initialProject: Project
  onSave: (project: Project) => void
  onCancel: () => void
}

function automaticStatus(schedule: ProjectSchedule): ProjectStage | null {
  for (let index = PROJECT_STAGES.length - 1; index >= 0; index -= 1) {
    const stage = PROJECT_STAGES[index]
    if (schedule[stage].actual !== null) {
      return stage
    }
  }

  return null
}

export default function ProjectForm({
  initialProject,
  onSave,
  onCancel,
}: ProjectFormProps) {
  const [project, setProject] = useState<Project>(() => ({
    ...initialProject,
    schedule: Object.fromEntries(
      PROJECT_STAGES.map((stage) => [stage, { ...initialProject.schedule[stage] }]),
    ) as ProjectSchedule,
  }))
  const [nameError, setNameError] = useState('')
  const derivedStatus = useMemo(
    () => automaticStatus(project.schedule),
    [project.schedule],
  )

  function updateSchedule(
    stage: ProjectStage,
    field: 'plan' | 'actual',
    value: string,
  ) {
    setProject((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [stage]: {
          ...current.schedule[stage],
          [field]: value === '' ? null : value,
        },
      },
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = project.name.trim()
    if (trimmedName === '') {
      setNameError('사업명을 입력해 주세요.')
      return
    }

    onSave({ ...project, name: trimmedName })
  }

  return (
    <form className="project-form" aria-label="사업 수정" onSubmit={handleSubmit}>
      <div className="form-field-grid">
        <label>
          사업명
          <input
            aria-label="사업명"
            aria-invalid={nameError !== ''}
            value={project.name}
            onChange={(event) => {
              setProject((current) => ({ ...current, name: event.target.value }))
              if (nameError !== '') setNameError('')
            }}
          />
          {nameError !== '' ? <span className="field-error">{nameError}</span> : null}
        </label>
        <label>
          소재지
          <input
            value={project.location}
            onChange={(event) =>
              setProject((current) => ({ ...current, location: event.target.value }))
            }
          />
        </label>
        <label>
          양극재/음극재
          <select
            value={project.material}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                material: event.target.value as Project['material'],
              }))
            }
          >
            <option value="양극재">양극재</option>
            <option value="음극재">음극재</option>
          </select>
        </label>
        <label>
          사업상태
          <select
            value={project.status}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                status: event.target.value as ProjectStage,
              }))
            }
          >
            {PROJECT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="status-comparison">
        <p>자동 단계: {derivedStatus ?? '실적 없음'}</p>
        {derivedStatus !== project.status ? (
          <p className="status-warning" role="alert">
            수동 사업상태와 자동 단계가 일치하지 않습니다.
          </p>
        ) : null}
      </div>

      <fieldset className="schedule-editor">
        <legend>주요 일정 (관리자 입력)</legend>
        <p className="form-help">각 날짜 칸을 누르면 달력에서 계획일과 실적일을 선택할 수 있습니다.</p>
        <div className="table-scroll">
          <table aria-label="사업 일정 입력">
            <thead>
              <tr>
                <th scope="col">단계</th>
                <th scope="col">계획일</th>
                <th scope="col">실적일</th>
              </tr>
            </thead>
            <tbody>
              {PROJECT_STAGES.map((stage) => (
                <tr key={stage}>
                  <th scope="row">{stage}</th>
                  <td>
                    <label className="visually-hidden" htmlFor={`${stage}-plan`}>
                      {stage} 계획일
                    </label>
                    <input
                      id={`${stage}-plan`}
                      type="date"
                      title="달력에서 계획일 선택"
                      value={project.schedule[stage].plan ?? ''}
                      onChange={(event) => updateSchedule(stage, 'plan', event.target.value)}
                    />
                  </td>
                  <td>
                    <label className="visually-hidden" htmlFor={`${stage}-actual`}>
                      {stage} 실적일
                    </label>
                    <input
                      id={`${stage}-actual`}
                      type="date"
                      title="달력에서 실적일 선택"
                      value={project.schedule[stage].actual ?? ''}
                      onChange={(event) =>
                        updateSchedule(stage, 'actual', event.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          취소
        </button>
        <button className="primary-button" type="submit">
          저장
        </button>
      </div>
    </form>
  )
}
