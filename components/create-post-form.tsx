"use client";

import { useState } from "react";
import { useAuth } from "@/components/liff-provider";
import { getPets } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, X } from "lucide-react";
import type { Pet } from "@/lib/types";
import { imageFileSchema } from "@/lib/validations";
import { useEffect } from "react";

interface CreatePostFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreatePostForm({ onSuccess, onCancel }: CreatePostFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getPets(user.id).then(({ data }) => {
        setPets(data || []);
        if (data && data.length > 0) {
          setSelectedPetId(data[0].id);
        }
      });
    }
  }, [user]);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mediaFile) return;

    if (mediaFile.type.startsWith("image/")) {
      const fileResult = imageFileSchema.safeParse({ size: mediaFile.size, type: mediaFile.type });
      if (!fileResult.success) {
        alert(fileResult.error.issues[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", mediaFile);
      if (caption) formData.append("caption", caption);
      if (selectedPetId) formData.append("pet_id", selectedPetId);

      await apiFetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      onSuccess?.();
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-main">Create Post</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="ปิด"
            className="text-text-muted hover:text-text-main"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Media Upload */}
        <div className="space-y-2">
          <Label>Photo or Video *</Label>
          <label className="cursor-pointer block">
            <div className="aspect-square max-h-64 rounded-xl bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center overflow-hidden">
              {mediaPreview ? (
                mediaFile?.type.startsWith("video/") ? (
                  <video src={mediaPreview} className="w-full h-full object-cover" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="text-center p-4">
                  <Camera className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm text-text-muted">Tap to upload</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaChange}
              className="hidden"
              required
            />
          </label>
        </div>

        {/* Select Pet */}
        {pets.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="pet">Tag a Pet (Optional)</Label>
            <select
              id="pet"
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="w-full p-3 border border-border rounded-xl bg-background text-text-main"
            >
              <option value="">No tag</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Caption */}
        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Share something about this moment..."
            className="w-full p-3 border border-border rounded-xl bg-background text-text-main min-h-[80px] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
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
            disabled={loading || !mediaFile}
            className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
