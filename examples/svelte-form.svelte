<script lang="ts">
  import { onDestroy } from "svelte"
  import { formPersist } from "form-persist/svelte"

  let currentStep = 0
  let hasSavedData = false
  let isRestored = false

  const persist = formPersist({
    key: "vaccine-arrival-svelte",
    steps: 3,
    ttl: "24h",
    clearOnSubmit: true,
    async onRestore(saved) {
      if (saved.steps[0]) Object.assign(step0, saved.steps[0].data)
      if (saved.steps[1]) Object.assign(step1, saved.steps[1].data)
      currentStep = saved.currentStep
      isRestored = true
    },
    onExpire() {
      alert("Your saved form data has expired.")
    },
  })

  // Check for saved data on mount
  persist.hasData().then((has) => { hasSavedData = has })

  let step0 = { facilityCode: "", arrivalDate: "" }
  let step1 = { batchNumber: "", quantity: 0 }

  async function autoSave(stepIndex: number, data: object) {
    await persist.save(stepIndex, data)
    hasSavedData = true
  }

  async function handleRestore() {
    await persist.restore()
    hasSavedData = false
  }

  async function handleReset() {
    if (confirm("Clear all saved progress?")) {
      await persist.reset()
      step0 = { facilityCode: "", arrivalDate: "" }
      step1 = { batchNumber: "", quantity: 0 }
      currentStep = 0
      hasSavedData = false
      isRestored = false
    }
  }

  async function confirmStep(stepIndex: number, data: object) {
    await persist.completeStep(stepIndex, data)
    currentStep = stepIndex + 1
  }

  async function handleSubmit() {
    await fetch("/api/vaccine-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step0, step1 }),
    })
    await persist.clear("submit")
    alert("Report submitted!")
  }

  onDestroy(() => persist.destroy())
</script>

{#if hasSavedData && !isRestored}
  <div class="restore-banner">
    <p>You have saved progress. Resume from Step {currentStep + 1}?</p>
    <button on:click={handleRestore}>Continue</button>
    <button on:click={handleReset}>Start fresh</button>
  </div>
{/if}

<div class="steps">
  <span class:active={currentStep === 0} class:done={currentStep > 0}>Step 1</span>
  <span class:active={currentStep === 1} class:done={currentStep > 1}>Step 2</span>
  <span class:active={currentStep === 2}>Step 3</span>
</div>

{#if currentStep === 0}
  <div>
    <h2>Step 1: Facility</h2>
    <input
      bind:value={step0.facilityCode}
      placeholder="Facility Code"
      on:input={() => autoSave(0, step0)}
    />
    <input
      bind:value={step0.arrivalDate}
      type="date"
      on:input={() => autoSave(0, step0)}
    />
    <button on:click={() => confirmStep(0, step0)}>Next</button>
  </div>
{/if}

{#if currentStep === 1}
  <div>
    <h2>Step 2: Batch Details</h2>
    <input
      bind:value={step1.batchNumber}
      placeholder="Batch Number"
      on:input={() => autoSave(1, step1)}
    />
    <input
      bind:value={step1.quantity}
      type="number"
      placeholder="Quantity"
      on:input={() => autoSave(1, step1)}
    />
    <button on:click={() => confirmStep(1, step1)}>Next</button>
  </div>
{/if}

{#if currentStep === 2}
  <div>
    <h2>Step 3: Confirm</h2>
    <p>Facility: {step0.facilityCode} — Batch: {step1.batchNumber}</p>
    <button on:click={handleSubmit}>Submit Report</button>
  </div>
{/if}

<style>
  .restore-banner {
    background: #e8f4fd;
    padding: 12px;
    margin-bottom: 16px;
    border-radius: 4px;
  }
  .steps span {
    margin-right: 8px;
    opacity: 0.4;
  }
  .steps span.active {
    opacity: 1;
    font-weight: bold;
  }
  .steps span.done {
    opacity: 1;
    color: green;
  }
</style>
