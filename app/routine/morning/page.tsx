import { AppShell } from '@/components/layout/AppShell'
import { RoutineChecklist } from '@/components/routine/RoutineChecklist'

export default function MorningRoutinePage() {
  return (
    <AppShell>
      <RoutineChecklist type="morning" />
    </AppShell>
  )
}
