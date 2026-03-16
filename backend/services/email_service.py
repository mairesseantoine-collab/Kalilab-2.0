"""Service d'envoi d'emails via Microsoft 365 SMTP (smtp.office365.com:587).

Variables d'environnement requises dans .env :
    SMTP_HOST      = smtp.office365.com
    SMTP_PORT      = 587
    SMTP_USER      = kalilab@monlabo.be          (compte d'envoi)
    SMTP_PASSWORD  = mot_de_passe_application    (mot de passe app Outlook)
    SMTP_FROM      = kalilab@monlabo.be          (adresse expéditeur, = SMTP_USER par défaut)
    APP_URL        = http://localhost:8000        (lien dans l'email)

Si SMTP_USER ou SMTP_PASSWORD ne sont pas configurés, les emails sont ignorés
silencieusement — les messages restent stockés dans la base de données.
"""

import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.office365.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
APP_URL = os.getenv("APP_URL", "http://localhost:8000")


def _build_html(expediteur_nom: str, sujet: str, corps_preview: str) -> str:
    preview = corps_preview[:400] + ("…" if len(corps_preview) > 400 else "")
    link = f"{APP_URL}/messagerie"
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f6fa;margin:0;padding:20px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- En-tête -->
    <div style="background:linear-gradient(135deg,#1F497D,#2D6BA3);padding:24px 28px;">
      <span style="color:#fff;font-size:20px;font-weight:800;">🧪 KaliLab</span>
      <span style="color:rgba(255,255,255,0.7);font-size:12px;margin-left:8px;">SMQ ISO 15189</span>
    </div>
    <!-- Corps -->
    <div style="padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">
        Vous avez reçu un <strong>nouveau message interne</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;width:90px;vertical-align:top;">De :</td>
          <td style="padding:8px 0;font-size:13px;font-weight:600;color:#1a1a2e;">{expediteur_nom}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#666;font-size:13px;vertical-align:top;">Sujet :</td>
          <td style="padding:8px 0;font-size:13px;color:#1a1a2e;">{sujet}</td>
        </tr>
      </table>
      <div style="background:#f5f6fa;border-left:4px solid #1F497D;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#444;line-height:1.6;">{preview}</p>
      </div>
      <a href="{link}" style="display:inline-block;background:#1F497D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
        Lire le message dans KaliLab →
      </a>
    </div>
    <!-- Pied de page -->
    <div style="padding:16px 28px;background:#f5f6fa;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#999;">
        Cet email a été envoyé automatiquement par KaliLab. Ne répondez pas directement à cet email — utilisez la messagerie interne de l'application.
      </p>
    </div>
  </div>
</body>
</html>"""


async def send_notification_email(
    to_email: str,
    expediteur_nom: str,
    sujet: str,
    corps_preview: str,
) -> bool:
    """Envoie une notification email Outlook à un destinataire.

    Returns:
        True  — email envoyé avec succès
        False — SMTP non configuré ou erreur (dégradation silencieuse)
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.debug("SMTP non configuré (SMTP_USER/SMTP_PASSWORD vides) — email ignoré")
        return False

    try:
        import aiosmtplib  # import tardif pour éviter l'erreur si non installé

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[KaliLab] Nouveau message de {expediteur_nom} : {sujet}"
        msg["From"] = SMTP_FROM or SMTP_USER
        msg["To"] = to_email

        # Version texte brut (fallback)
        text_body = (
            f"Nouveau message de {expediteur_nom}\n"
            f"Sujet : {sujet}\n\n"
            f"{corps_preview[:400]}\n\n"
            f"Voir dans KaliLab : {APP_URL}/messagerie"
        )
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(_build_html(expediteur_nom, sujet, corps_preview), "html", "utf-8"))

        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
            timeout=10,
        )
        logger.info("Email envoyé à %s — sujet: %s", to_email, sujet)
        return True

    except ImportError:
        logger.warning("aiosmtplib non installé — email ignoré (pip install aiosmtplib)")
        return False
    except Exception as exc:
        logger.error("Erreur SMTP lors de l'envoi à %s : %s", to_email, exc)
        return False
