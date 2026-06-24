import React, { useState } from "react"
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFormPersistNative } from "form-persist/react-native"

interface StepData {
  facilityCode: string
  batchNumber: string
  quantity: string
}

export default function VaccineFormNative() {
  const [step0, setStep0] = useState({ facilityCode: "" })
  const [step1, setStep1] = useState({ batchNumber: "", quantity: "" })

  const {
    save,
    restore,
    clear,
    reset,
    completeStep,
    currentStep,
    hasData,
    isRestored,
  } = useFormPersistNative({
    key: "vaccine-arrival-mobile",
    steps: 2,
    ttl: "48h",
    storage: AsyncStorage,
    clearOnSubmit: true,
    onRestore: (saved) => {
      if (saved.steps[0]) setStep0(saved.steps[0].data as typeof step0)
      if (saved.steps[1]) setStep1(saved.steps[1].data as typeof step1)
    },
  })

  const handleClearPress = () => {
    Alert.alert(
      "Clear Saved Data",
      "This will erase your saved form progress. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, clear it",
          style: "destructive",
          onPress: async () => {
            await reset()
            setStep0({ facilityCode: "" })
            setStep1({ batchNumber: "", quantity: "" })
          },
        },
      ]
    )
  }

  const handleSubmit = async () => {
    await fetch("https://api.example.com/vaccine-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step0, step1 }),
    })
    await clear("submit")
    Alert.alert("Success", "Report submitted!")
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {hasData && !isRestored && (
        <View style={{ marginBottom: 16, padding: 12, backgroundColor: "#e8f4fd" }}>
          <Text>You have saved progress from a previous session.</Text>
          <Button title="Continue where I left off" onPress={restore} />
          <Button title="Start fresh" color="red" onPress={handleClearPress} />
        </View>
      )}

      {currentStep === 0 && (
        <View>
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>Step 1: Facility</Text>
          <TextInput
            placeholder="Facility Code"
            value={step0.facilityCode}
            onChangeText={(text) => {
              const updated = { facilityCode: text }
              setStep0(updated)
              void save(0, updated)
            }}
            style={{ borderWidth: 1, padding: 8, marginVertical: 8 }}
          />
          <Button
            title="Next"
            onPress={async () => {
              await completeStep(0, step0)
            }}
          />
        </View>
      )}

      {currentStep === 1 && (
        <View>
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>Step 2: Batch Details</Text>
          <TextInput
            placeholder="Batch Number"
            value={step1.batchNumber}
            onChangeText={(text) => {
              const updated = { ...step1, batchNumber: text }
              setStep1(updated)
              void save(1, updated)
            }}
            style={{ borderWidth: 1, padding: 8, marginVertical: 8 }}
          />
          <TextInput
            placeholder="Quantity"
            value={step1.quantity}
            keyboardType="numeric"
            onChangeText={(text) => {
              const updated = { ...step1, quantity: text }
              setStep1(updated)
              void save(1, updated)
            }}
            style={{ borderWidth: 1, padding: 8, marginVertical: 8 }}
          />
          <Button title="Submit" onPress={handleSubmit} />
        </View>
      )}

      {hasData && (
        <Button title="Clear saved data" color="grey" onPress={handleClearPress} />
      )}
    </ScrollView>
  )
}
