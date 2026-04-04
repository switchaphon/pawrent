"use client";

import { useState, useMemo } from "react";
import { updatePet, uploadPetPhoto } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ImageCropper } from "@/components/image-cropper";
import { SearchableSelect } from "@/components/searchable-select";
import { Camera, Loader2, X, Pencil } from "lucide-react";
import type { Pet } from "@/lib/types";
import speciesData from "@/data/species.json";
import breedsData from "@/data/breeds.json";

interface EditPetFormProps {
  pet: Pet;
  onSuccess?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

// Helper to get breed options based on selected species
function getBreedOptions(species: string): string[] {
  const speciesKey = species.toLowerCase().replace(" ", "_") as keyof typeof breedsData;
  if (breedsData[speciesKey]) {
    return breedsData[speciesKey];
  }
  // Fallback for species without specific breeds
  return breedsData.other || ["Mixed Breed", "Other"];
}

export function EditPetForm({ pet, onSuccess, onCancel }: EditPetFormProps) {
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(pet.photo_url);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: pet.name || "",
    species: pet.species || "",
    breed: pet.breed || "",
    sex: pet.sex || "",
    color: pet.color || "",
    weight_kg: pet.weight_kg?.toString() || "",
    date_of_birth: pet.date_of_birth || "",
    microchip_number: pet.microchip_number || "",
    special_notes: pet.special_notes || "",
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setImageToCrop(imageUrl);
      setShowCropper(true);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "cropped-photo.jpg", { type: "image/jpeg" });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(croppedBlob));
    setShowCropper(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let newPhotoUrl = pet.photo_url;

      // Upload new photo if selected
      if (photoFile) {
        const { url, error: uploadError } = await uploadPetPhoto(photoFile, pet.id);
        if (uploadError) {
          console.error("Photo upload error:", uploadError);
        } else if (url) {
          newPhotoUrl = url;
        }
      }

      // Update pet
      const { error: updateError } = await updatePet(pet.id, {
        name: formData.name,
        species: formData.species || null,
        breed: formData.breed || null,
        sex: formData.sex || null,
        color: formData.color || null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        date_of_birth: formData.date_of_birth || null,
        microchip_number: formData.microchip_number || null,
        special_notes: formData.special_notes || null,
        photo_url: newPhotoUrl,
      });

      if (updateError) {
        console.error("Update error:", updateError);
        alert("Failed to update pet profile");
        return;
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error updating pet:", error);
      alert("Failed to update pet profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Image Cropper Modal */}
      {showCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          cropShape="rect"
        />
      )}

      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Edit Profile
          </h2>
          {onCancel && (
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload */}
          <div className="flex justify-center">
            <label className="cursor-pointer relative">
              <div className="w-24 h-24 rounded-lg bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Pet preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-center text-muted-foreground">Tap to change & crop photo</p>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Fido"
              className="h-12 rounded-xl"
              required
            />
          </div>

          {/* Species */}
          <div className="space-y-2">
            <Label>Species</Label>
            <SearchableSelect
              value={formData.species}
              onChange={(value) => setFormData({ ...formData, species: value, breed: "" })}
              options={speciesData.species.map((s) => s.name)}
              placeholder="Select species..."
            />
          </div>

          {/* Breed - Dynamic based on species */}
          <div className="space-y-2">
            <Label>Breed</Label>
            <SearchableSelect
              value={formData.breed}
              onChange={(value) => setFormData({ ...formData, breed: value })}
              options={getBreedOptions(formData.species)}
              placeholder={formData.species ? "Select breed..." : "Select species first"}
            />
          </div>

          {/* Sex */}
          <div className="space-y-2">
            <Label>Sex</Label>
            <div className="flex gap-2">
              {["Male", "Female"].map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => setFormData({ ...formData, sex })}
                  className={`flex-1 h-12 rounded-xl border-2 font-medium transition-colors ${
                    formData.sex === sex
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-foreground hover:border-gray-300"
                  }`}
                >
                  {sex === "Male" ? "♂" : "♀"} {sex}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="e.g., Golden, Black, White"
              className="h-12 rounded-xl"
            />
          </div>

          {/* Weight & DOB */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                placeholder="e.g., 12.5"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          {/* Microchip ID */}
          <div className="space-y-2">
            <Label htmlFor="microchip">Microchip ID</Label>
            <Input
              id="microchip"
              value={formData.microchip_number}
              onChange={(e) => setFormData({ ...formData, microchip_number: e.target.value })}
              placeholder="e.g., 123456789012345"
              className="h-12 rounded-xl font-mono"
            />
          </div>

          {/* Special Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Special Notes / Marks</Label>
            <textarea
              id="notes"
              value={formData.special_notes}
              onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })}
              placeholder="e.g., White patch on chest, shy around strangers"
              className="w-full h-20 px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || !formData.name}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
