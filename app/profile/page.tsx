"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreatePetForm } from "@/components/create-pet-form";
import { ImageCropper } from "@/components/image-cropper";
import { getPets, submitFeedback, uploadFeedbackImage, getProfile, upsertProfile, uploadProfileAvatar } from "@/lib/db";
import type { Pet, Profile } from "@/lib/types";
import { Bell, Shield, LogOut, Plus, PawPrint, Loader2, MessageSquare, X, ImagePlus, CheckCircle, Pencil, Camera } from "lucide-react";

function ProfileContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPet, setShowAddPet] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackImage, setFeedbackImage] = useState<File | null>(null);
  const [feedbackImagePreview, setFeedbackImagePreview] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  
  // Edit Profile State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState<string | null>(null);

  const fetchPets = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getPets(user.id);
    setPets(data || []);
    setLoading(false);
  };
  
  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await getProfile(user.id);
    if (data) {
      setProfile(data);
      setEditName(data.full_name || "");
    }
  };

  useEffect(() => {
    fetchPets();
    fetchProfile();
  }, [user]);

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowFeedback(false);
              setFeedbackText("");
              setFeedbackImage(null);
              setFeedbackImagePreview(null);
            }}
          />
          <Card className="relative p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <button
              onClick={() => {
                setShowFeedback(false);
                setFeedbackText("");
                setFeedbackImage(null);
                setFeedbackImagePreview(null);
                setFeedbackSuccess(false);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            
            {feedbackSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Thank You!</h2>
                <p className="text-muted-foreground">Your feedback has been submitted successfully.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Send Feedback</h2>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Help us improve Pawrent! Share your experience, report issues, or suggest new features.
                </p>
            
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Describe your feedback, issue, or suggestion..."
              className="w-full h-32 p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
            
            {/* Image Upload */}
            <div className="mt-4">
              {feedbackImagePreview ? (
                <div className="relative">
                  <img
                    src={feedbackImagePreview}
                    alt="Feedback attachment"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setFeedbackImage(null);
                      setFeedbackImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Attach screenshot (optional)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFeedbackImage(file);
                        setFeedbackImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              )}
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeedback(false);
                  setFeedbackText("");
                  setFeedbackImage(null);
                  setFeedbackImagePreview(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!user) return;
                  setSubmittingFeedback(true);
                  try {
                    let imageUrl: string | null = null;
                    
                    // Upload image if attached
                    if (feedbackImage) {
                      const tempId = `${user.id}_${Date.now()}`;
                      const { data: uploadedUrl, error: uploadError } = await uploadFeedbackImage(feedbackImage, tempId);
                      if (uploadError) {
                        console.error("Failed to upload image:", uploadError);
                      } else {
                        imageUrl = uploadedUrl;
                      }
                    }
                    
                    // Submit feedback
                    const { error } = await submitFeedback({
                      user_id: user.id,
                      message: feedbackText,
                      image_url: imageUrl,
                    });
                    
                    if (error) {
                      alert("Failed to submit feedback. Please try again.");
                      console.error("Feedback error:", error);
                    } else {
                      // Show success state
                      setFeedbackSuccess(true);
                      setFeedbackText("");
                      setFeedbackImage(null);
                      setFeedbackImagePreview(null);
                      // Auto close after 1.5 seconds
                      setTimeout(() => {
                        setShowFeedback(false);
                        setFeedbackSuccess(false);
                      }, 1500);
                    }
                  } catch (err) {
                    console.error("Unexpected error:", err);
                    alert("An unexpected error occurred.");
                  } finally {
                    setSubmittingFeedback(false);
                  }
                }}
                disabled={!feedbackText.trim() || submittingFeedback}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {submittingFeedback ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPrivacy(false)}
          />
          <Card className="relative p-6 rounded-2xl max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Privacy & Security</h2>
            </div>
            
            <div className="space-y-4 text-sm text-muted-foreground">
              <section>
                <h3 className="font-semibold text-foreground mb-2">PDPA Privacy Notice</h3>
                <p>
                  Pawrent respects your privacy and is committed to protecting your personal data 
                  in accordance with Thailand's Personal Data Protection Act (PDPA) B.E. 2562.
                </p>
              </section>
              
              <section>
                <h3 className="font-semibold text-foreground mb-2">Data We Collect</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Account information (email, name)</li>
                  <li>Pet information (name, species, breed, photos)</li>
                  <li>Health records (vaccinations, medical history)</li>
                  <li>Location data (for SOS alerts only)</li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-semibold text-foreground mb-2">How We Use Your Data</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>To provide pet passport services</li>
                  <li>To send SOS alerts to nearby users</li>
                  <li>To improve our services</li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-semibold text-foreground mb-2">Your Rights</h3>
                <p>
                  Under PDPA, you have the right to access, correct, delete, or transfer your personal data. 
                  Contact us at privacy@pawrent.app for any data-related requests.
                </p>
              </section>
              
              <section>
                <h3 className="font-semibold text-foreground mb-2">Data Security</h3>
                <p>
                  We use industry-standard encryption and security measures to protect your data. 
                  Your information is stored securely and never shared with third parties without consent.
                </p>
              </section>
            </div>
            
            <Button
              onClick={() => setShowPrivacy(false)}
              className="w-full mt-6 bg-primary hover:bg-primary/90"
            >
              I Understand
            </Button>
          </Card>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowEditProfile(false);
              setEditAvatarFile(null);
              setEditAvatarPreview(null);
            }}
          />
          <Card className="relative p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <button
              onClick={() => {
                setShowEditProfile(false);
                setEditAvatarFile(null);
                setEditAvatarPreview(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-foreground mb-6">Edit Profile</h2>
            
            {/* Image Cropper Modal */}
            {showAvatarCropper && avatarImageToCrop && (
              <ImageCropper
                imageSrc={avatarImageToCrop}
                onCropComplete={(croppedBlob) => {
                  const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
                  setEditAvatarFile(file);
                  setEditAvatarPreview(URL.createObjectURL(croppedBlob));
                  setShowAvatarCropper(false);
                  setAvatarImageToCrop(null);
                }}
                onCancel={() => {
                  setShowAvatarCropper(false);
                  setAvatarImageToCrop(null);
                }}
                aspectRatio={1}
                cropShape="rect"
              />
            )}
            
            {/* Photo Upload - Matching Pet Photo Design */}
            <div className="flex justify-center">
              <label className="cursor-pointer relative">
                <div className="w-24 h-24 rounded-lg bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center overflow-hidden">
                  {(editAvatarPreview || profile?.avatar_url) ? (
                    <img
                      src={editAvatarPreview || profile?.avatar_url || ""}
                      alt="Profile preview"
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
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const imageUrl = URL.createObjectURL(file);
                      setAvatarImageToCrop(imageUrl);
                      setShowAvatarCropper(true);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2 mb-4">Tap to change & crop photo</p>
            
            {/* Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                className="w-full p-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditProfile(false);
                  setEditAvatarFile(null);
                  setEditAvatarPreview(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!user) return;
                  setSavingProfile(true);
                  try {
                    let avatarUrl = profile?.avatar_url || null;
                    
                    // Upload new avatar if selected
                    if (editAvatarFile) {
                      const { data: uploadedUrl, error: uploadError } = await uploadProfileAvatar(editAvatarFile, user.id);
                      if (!uploadError && uploadedUrl) {
                        avatarUrl = uploadedUrl;
                      }
                    }
                    
                    // Update profile
                    await upsertProfile({
                      id: user.id,
                      full_name: editName || null,
                      avatar_url: avatarUrl,
                    });
                    
                    // Refresh profile and close
                    await fetchProfile();
                    setShowEditProfile(false);
                    setEditAvatarFile(null);
                    setEditAvatarPreview(null);
                  } catch (err) {
                    console.error("Failed to update profile:", err);
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                disabled={savingProfile}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {savingProfile ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
      </header>

      {/* Profile Content */}
      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        {showAddPet ? (
          <CreatePetForm
            onSuccess={() => {
              setShowAddPet(false);
              fetchPets();
            }}
            onCancel={() => setShowAddPet(false)}
          />
        ) : (
          <>
            {/* User Card */}
            <Card className="p-6 rounded-2xl text-center relative">
              <button
                onClick={() => setShowEditProfile(true)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
              <Avatar className="w-20 h-20 mx-auto mb-4">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {user?.email ? getInitials(user.email) : "?"}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-foreground">
                {profile?.full_name || user?.email?.split("@")[0] || "Pet Parent"}
              </h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex justify-center gap-6 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{pets.length}</p>
                  <p className="text-xs text-muted-foreground">Pets</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">0</p>
                  <p className="text-xs text-muted-foreground">SOS Alerts</p>
                </div>
              </div>
            </Card>

            {/* My Pets */}
            {pets.length > 0 && (
              <Card className="rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <PawPrint className="w-4 h-4 text-primary" />
                    My Pets
                  </h3>
                </div>
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => router.push(`/pets?pet=${pet.id}`)}
                    className="w-full flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {pet.photo_url ? (
                        <img
                          src={pet.photo_url}
                          alt={pet.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🐕</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{pet.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pet.breed || "Unknown breed"}
                      </p>
                    </div>
                  </button>
                ))}
              </Card>
            )}

            {/* Menu Items - Compact with Breathing Room */}
            <div className="space-y-2">
              <button 
                onClick={() => router.push('/notifications')}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors rounded-lg border border-border"
              >
                <Bell className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">Notifications</span>
              </button>
              <button 
                onClick={() => setShowPrivacy(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors rounded-lg border border-border"
              >
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">Privacy & Security</span>
              </button>
              <button 
                onClick={() => router.push('/feedback')}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors rounded-lg border border-border"
              >
                <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">Feedback</span>
              </button>
            </div>

            {/* Sign Out Button - Separated */}
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}
