import { useRef, useState } from "react";
import { Settings, User, KeyRound, Bell, Camera, RefreshCw, Languages } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EMAIL_PATTERN, useLiveValidation } from "@/components/AuthFields";
import { LanguageToggle, useT } from "@/lib/i18n";

const AVATAR_TARGET_PX = 128;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AVATAR_MAX_MB = 5;

// Compact input with an inline, animated error - the settings cards are too
// small for the full-size auth fields.
function SettingsInput({ id, error, ...props }) {
  return (
    <div>
      <input
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="input-field w-full text-sm"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} key={error} className="field-error mt-1 text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

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

// `defaultExpanded` lets the profile page's Account tab show the settings
// open, instead of behind the Show/Hide toggle.
function AccountSettings({ defaultExpanded = false } = {}) {
  const t = useT();
  const { user, updateUser } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded);
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

  const profileForm = useLiveValidation(
    ({ name, email }) => {
      const errors = {};
      if (name.trim().length < 2) errors.name = "Name must be at least 2 characters";
      else if (name.trim().length > 100) errors.name = "Name must be 100 characters or fewer";
      if (!email.trim()) errors.email = "Enter your e-mail address";
      else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid e-mail address";
      return errors;
    },
    { name, email }
  );
  const passwordForm = useLiveValidation(
    ({ currentPassword, newPassword, confirmPassword }) => {
      const errors = {};
      if (!currentPassword) errors.currentPassword = "Enter your current password";
      if (newPassword.length < 6) errors.newPassword = "Use at least 6 characters";
      else if (newPassword === currentPassword) errors.newPassword = "Choose a password different from the current one";
      if (!confirmPassword) errors.confirmPassword = "Type the new password again";
      else if (confirmPassword !== newPassword) errors.confirmPassword = "The two passwords do not match";
      return errors;
    },
    { currentPassword, newPassword, confirmPassword }
  );

  if (!user) return null;

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!profileForm.check()) return;
    if (name.trim() === (user.name || "") && email.trim() === (user.email || "")) {
      toast.info("Nothing to save", { description: "Your name and e-mail are unchanged." });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.put(`/users/${user.id}`, { name: name.trim(), email: email.trim() });
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
    if (!passwordForm.check()) return;
    setSavingPassword(true);
    try {
      await api.post(`/users/${user.id}/change-password`, { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      passwordForm.reset();
    } catch (err) {
      toast.error(err.message || "Couldn't change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Unsupported image type", { description: "Choose a PNG, JPEG or WebP picture." });
      e.target.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      toast.error("That picture is too large", { description: `Choose one smaller than ${AVATAR_MAX_MB} MB.` });
      e.target.value = "";
      return;
    }
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
      toast.success(checked ? "Quiz e-mails turned on" : "Quiz e-mails turned off");
    } catch (err) {
      setQuizUnlocked(!checked);
      toast.error(err.message || "Couldn't update notification preference");
      return;
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
        <div className="cascade mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsCard icon={User} title="Profile info">
            <form onSubmit={handleSaveProfile} noValidate className="space-y-2">
              <SettingsInput
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={profileForm.blur("name")}
                placeholder="Name"
                aria-label="Name"
                autoComplete="name"
                error={profileForm.errors.name}
              />
              <SettingsInput
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={profileForm.blur("email")}
                placeholder="Email"
                aria-label="E-mail address"
                autoComplete="email"
                error={profileForm.errors.email}
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
            <form onSubmit={handleChangePassword} noValidate className="space-y-2">
              <SettingsInput
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                aria-label="Current password"
                autoComplete="current-password"
                error={passwordForm.errors.currentPassword}
              />
              <SettingsInput
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={passwordForm.blur("newPassword")}
                placeholder="New password (at least 6 characters)"
                aria-label="New password"
                autoComplete="new-password"
                error={passwordForm.errors.newPassword}
              />
              <SettingsInput
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={passwordForm.blur("confirmPassword")}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                autoComplete="new-password"
                error={passwordForm.errors.confirmPassword}
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
                <p className="text-[10px] text-muted-foreground mt-1">PNG, JPEG or WebP, up to {AVATAR_MAX_MB} MB</p>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard icon={Languages} title={t("Language")}>
            <p className="text-xs text-muted-foreground mb-3">{t("Menus and pages are shown in this language. Lesson and quiz content stays in English.")}</p>
            <LanguageToggle />
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
