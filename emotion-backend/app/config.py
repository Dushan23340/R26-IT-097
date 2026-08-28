from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    APP_NAME: str = "Emotion Analytics Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # CORS
    # No .env is loaded here (no env_file configured on this Settings
    # class), so this default is the only source of truth - a LAN-only
    # origin like a student laptop hitting this machine's IP directly
    # must be listed here explicitly, not just localhost/127.0.0.1.
    # Update the IP if the demo machine's LAN IP changes on a different
    # network (find it with `ipconfig getifaddr en0` on macOS).
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3002,http://localhost:3003,http://localhost:5173,http://localhost:8080,http://localhost:8081,http://192.168.8.182:3002"

    # Analytics
    WINDOW_SECONDS: int = 60
    TOTAL_STUDENTS: int = 20
    ENGAGEMENT_THRESHOLD: float = 60.0
    ALERT_THRESHOLD: float = 20.0

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
