<script lang="ts">
  import { roundForDisplay, type Profile, type Nutrition } from '../domain/store'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'

  let {
    profile = $bindable(),
    overrideCalories = $bindable(),
    overrideProtein = $bindable(),
    overrideFat = $bindable(),
    overrideCarbohydrates = $bindable(),
    today,
    maintenanceCalories,
    targets,
    onSave,
  }: {
    profile: Profile
    overrideCalories: number | undefined
    overrideProtein: number | undefined
    overrideFat: number | undefined
    overrideCarbohydrates: number | undefined
    today: string
    maintenanceCalories: number
    targets: Nutrition
    onSave: (event: SubmitEvent) => void | Promise<void>
  } = $props()

  const displayNumber = roundForDisplay
</script>

<div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab">
  <Card.Root class="overflow-visible">
    <Card.Header><Card.Title id="profile-heading">Profile and targets</Card.Title></Card.Header>
    <Card.Content>
      <form class="grid gap-4" onsubmit={onSave}>
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label for="profile-age">Age</Label>
            <Input id="profile-age" type="number" min="1" max="120" bind:value={profile.age} required />
          </div>
          <div class="grid gap-2">
            <Label for="profile-sex">Sex</Label>
            <select
              id="profile-sex"
              class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              bind:value={profile.sex}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label for="profile-height">Height (cm)</Label>
            <Input id="profile-height" type="number" min="50" max="250" bind:value={profile.heightCm} required />
          </div>
          <div class="grid gap-2">
            <Label for="profile-weight">Weight (kg)</Label>
            <Input
              id="profile-weight"
              type="number"
              min="10"
              max="500"
              step="0.1"
              bind:value={profile.weightKg}
              required
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label for="profile-target-weight">Target weight (kg)</Label>
            <Input
              id="profile-target-weight"
              type="number"
              min="10"
              max="500"
              step="0.1"
              bind:value={profile.targetWeightKg}
              required
            />
          </div>
          <div class="grid gap-2">
            <Label for="profile-target-date">Target date</Label>
            <Input id="profile-target-date" type="date" min={today} bind:value={profile.targetDate} required />
          </div>
        </div>
        <div class="grid gap-4">
          <Label for="profile-activity">Activity</Label>
          <select
            id="profile-activity"
            class="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            bind:value={profile.activity}
          >
            <option value="bmrOnly">BMR only</option>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="very">Very active</option>
            <option value="extra">Extra active</option>
          </select>
        </div>
        <div class="bg-muted flex items-baseline justify-between rounded-md px-4 py-3">
          <span class="text-muted-foreground text-sm">Daily maintenance</span>
          <span class="text-xl font-semibold tabular-nums">{maintenanceCalories} kcal</span>
        </div>

        <Separator />

        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label for="profile-override-calories">Calories override</Label>
            <Input id="profile-override-calories" type="number" min="0" bind:value={overrideCalories} />
          </div>
          <div class="grid gap-2">
            <Label for="profile-override-protein">Protein override</Label>
            <Input id="profile-override-protein" type="number" min="0" step="0.1" bind:value={overrideProtein} />
          </div>
          <div class="grid gap-2">
            <Label for="profile-override-fat">Fat override</Label>
            <Input id="profile-override-fat" type="number" min="0" step="0.1" bind:value={overrideFat} />
          </div>
          <div class="grid gap-2">
            <Label for="profile-override-carbs">Carbohydrates override</Label>
            <Input id="profile-override-carbs" type="number" min="0" step="0.1" bind:value={overrideCarbohydrates} />
          </div>
        </div>

        <div class="bg-accent rounded-md px-4 py-3">
          <p class="text-2xl font-bold tabular-nums text-accent-foreground">
            {displayNumber(targets.calories)} kcal
          </p>
          <p class="text-muted-foreground text-sm">
            {displayNumber(targets.protein)} g protein · {displayNumber(targets.fat)} g fat · {displayNumber(
              targets.carbohydrates,
            )} g carbs
          </p>
        </div>
        <Button type="submit">Save profile</Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>
