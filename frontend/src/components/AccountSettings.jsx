import { useRef, useState } from "react";
import { Settings, User, KeyRound, Bell, Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const AVATAR_TARGET_PX = 128;

// Resizes/compresses in the browser before upload - keeps the Mongo
// document small without needing a server-side upload library (multer)
// this project doesn't otherwise use.
function fileToResizedJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("That doesn't look like a valid image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_TARGET_PX;
        canvas.height = AVATAR_TARGET_PX;
        const ctx = canvas.getContext("2d");
        // Center-crop to a square before scaling, so a non-square photo
        // doesn't come out squashed.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_TARGET_PX, AVATAR_TARGET_PX);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function SettingsCard({ icon: Icon, title, children }) {
  return (
    <div className="p-4 rounded-xl border border-border/60">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [quizUnlocked, setQuizUnlocked] = useState(user?.notificationPreferences?.quizUnlocked ?? true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  if (!user) return null;

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put(`/users/${user.id}`, { name, email });
      updateUser(res.user);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.message || "Couldn't update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post(`/users/${user.id}/change-password`, { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Couldn't change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const avatarDataUrl = await fileToResizedJpegDataUrl(file);
      const res = await api.put(`/users/${user.id}/avatar`, { avatarDataUrl });
      updateUser(res.user);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err.message || "Couldn't update avatar");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await api.delete(`/users/${user.id}/avatar`);
      updateUser(res.user);
      toast.success("Avatar removed");
    } catch (err) {
      toast.error(err.message || "Couldn't remove avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleToggleNotification(checked) {
    setQuizUnlocked(checked);
    setSavingNotifications(true);
    try {
      const res = await api.put(`/users/${user.id}/notifications`, { quizUnlocked: checked });
      updateUser(res.user);
    } catch (err) {
      setQuizUnlocked(!checked);
      toast.error(err.message || "Couldn't update notification preference");
    } finally {
      setSavingNotifications(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" /> Account Settings
        </h2>
        <span className="text-xs text-muted-foreground">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsCard icon={User} title="Profile info">
            <form onSubmit={handleSaveProfile} className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="input-field w-full text-sm"
                required
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="input-field w-full text-sm"
                required
              />
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingProfile && <RefreshCw className="h-3 w-3 animate-spin" />}
                Save
              </button>
            </form>
          </SettingsCard>

          <SettingsCard icon={KeyRound} title="Change password">
            <form onSubmit={handleChangePassword} className="space-y-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="input-field w-full text-sm"
                autoComplete="current-password"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="input-field w-full text-sm"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input-field w-full text-sm"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingPassword && <RefreshCw className="h-3 w-3 animate-spin" />}
                Change password
              </button>
            </form>
          </SettingsCard>

          <SettingsCard icon={Camera} title="Avatar">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden flex-shrink-0 bg-secondary flex items-center justify-center">
                {user.avatarDataUrl ? (
                  <img src={user.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-display font-bold">{(user.name || "?").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-border/60 hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploadingAvatar && <RefreshCw className="h-3 w-3 animate-spin" />}
                    Upload photo
                  </button>
                  {user.avatarDataUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">PNG, JPEG or WebP</p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard icon={Bell} title="Notifications">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={quizUnlocked}
                onChange={(e) => handleToggleNotification(e.target.checked)}
                disabled={savingNotifications}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground">
                Email me when a quiz I've completed a class for gets unlocked
              </span>
            </label>
          </SettingsCard>
        </div>
      )}
    </div>
  );
}

export { AccountSettings };
