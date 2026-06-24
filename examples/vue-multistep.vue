<template>
  <div>
    <div v-if="hasData && !isRestored" class="restore-banner">
      <p>You have saved progress. Resume from Step {{ currentStep + 1 }}?</p>
      <button @click="handleRestore">Continue</button>
      <button @click="handleReset">Start fresh</button>
    </div>

    <div class="step-indicator">
      <span
        v-for="i in totalSteps"
        :key="i"
        :class="{ active: currentStep === i - 1, done: currentStep > i - 1 }"
      >
        Step {{ i }}
      </span>
    </div>

    <!-- Step 1: Facility -->
    <div v-if="currentStep === 0">
      <h2>Step 1: Facility &amp; Arrival</h2>
      <input v-model="step0.facilityCode" placeholder="Facility Code" @input="autoSave(0, step0)" />
      <input v-model="step0.arrivalDate" type="date" @input="autoSave(0, step0)" />
      <button @click="confirmStep0">Next</button>
    </div>

    <!-- Step 2: Batch -->
    <div v-if="currentStep === 1">
      <h2>Step 2: Batch Information</h2>
      <input v-model="step1.batchNumber" placeholder="Batch Number" @input="autoSave(1, step1)" />
      <input v-model.number="step1.quantity" type="number" placeholder="Quantity" @input="autoSave(1, step1)" />
      <input v-model="step1.manufacturer" placeholder="Manufacturer" @input="autoSave(1, step1)" />
      <button @click="confirmStep1">Next</button>
    </div>

    <!-- Step 3: Submit -->
    <div v-if="currentStep === 2">
      <h2>Step 3: Confirm &amp; Submit</h2>
      <p>Facility: {{ step0.facilityCode }} — Batch: {{ step1.batchNumber }}</p>
      <button @click="handleSubmit">Submit Report</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useFormPersist } from "form-persist/vue"

const totalSteps = 3

const step0 = ref({ facilityCode: "", arrivalDate: "" })
const step1 = ref({ batchNumber: "", quantity: 0, manufacturer: "" })

const { save, restore, reset, clear, completeStep, currentStep, hasData, isRestored } =
  useFormPersist({
    key: "vaccine-arrival-vue",
    steps: totalSteps,
    ttl: "24h",
    clearOnSubmit: true,
    onRestore(saved) {
      if (saved.steps[0]) step0.value = saved.steps[0].data as typeof step0.value
      if (saved.steps[1]) step1.value = saved.steps[1].data as typeof step1.value
    },
    onExpire() {
      alert("Your saved form data has expired.")
    },
  })

function autoSave(stepIndex: number, data: object) {
  void save(stepIndex, data)
}

async function handleRestore() {
  await restore()
}

async function handleReset() {
  if (confirm("Clear all saved progress?")) {
    await reset()
    step0.value = { facilityCode: "", arrivalDate: "" }
    step1.value = { batchNumber: "", quantity: 0, manufacturer: "" }
  }
}

async function confirmStep0() {
  await completeStep(0, step0.value)
}

async function confirmStep1() {
  await completeStep(1, step1.value)
}

async function handleSubmit() {
  await fetch("/api/vaccine-arrival", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step0: step0.value, step1: step1.value }),
  })
  await clear("submit")
  alert("Report submitted!")
}
</script>

<style scoped>
.restore-banner {
  background: #e8f4fd;
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 4px;
}
.step-indicator span {
  margin-right: 8px;
  opacity: 0.5;
}
.step-indicator span.active {
  opacity: 1;
  font-weight: bold;
}
.step-indicator span.done {
  opacity: 1;
  color: green;
}
</style>
