import { AppShell } from '@/components/layout/AppShell'
import { RoutineChecklist } from '@/components/routine/RoutineChecklist'

export default function NightRoutinePage() {
  return (
    <AppShell>
      <RoutineChecklist type="night" />
    </AppShell>
  )
}
