"use client"

// TODO(phase-2): this editor is a near-duplicate of the DGK side's
// `app/(dgk)/orders/_components/packing-list-editor.tsx`. Kept duplicated on
// purpose — schemas diverge (CustomerOrderSubmissionValues vs OrderFormValues)
// and generalizing before a third form appears would be premature per the
// "abstract after two, not before" rule. If a third packing-list form shows
// up (e.g. a vendor return flow), factor out a generic editor parameterized
// on the form type.

import { Trash2 } from "lucide-react"
import { useFieldArray, type Control } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  PACKING_UNITS,
  type CustomerOrderSubmissionValues,
} from "../schema"

interface PackingListEditorProps {
  control: Control<
    CustomerOrderSubmissionValues,
    unknown,
    CustomerOrderSubmissionValues
  >
}

export function PackingListEditor({ control }: PackingListEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "packingList.items",
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_100px_120px_120px_40px] items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Weight (kg)</span>
        <span className="sr-only">Actions</span>
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_100px_120px_120px_40px] items-start gap-2"
        >
          <FormField
            control={control}
            name={`packingList.items.${index}.description`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="e.g. Frozen ayam goreng" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`packingList.items.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`packingList.items.${index}.unit`}
            render={({ field }) => (
              <FormItem>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PACKING_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`packingList.items.${index}.weightKg`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="optional"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(index)}
            disabled={fields.length === 1}
            aria-label="Remove item"
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({ description: "", quantity: 1, unit: "pcs", weightKg: null })
        }
      >
        + Add item
      </Button>
    </div>
  )
}
