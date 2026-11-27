import { Alert, Linking } from 'react-native';

/**
 * Normalise un numéro tunisien vers le format international WhatsApp (ex: 21650443951).
 */
export function normalizeWhatsAppDigits(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 8) {
    digits = `216${digits}`;
  }
  return digits;
}

export async function openWhatsAppDirect(phone: string): Promise<void> {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) {
    Alert.alert('Numéro indisponible', 'Aucun numéro de téléphone valide trouvé.');
    return;
  }
  const appUrl = `whatsapp://send?phone=${digits}`;
  const webUrl = `https://wa.me/${digits}`;
  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  } catch {
    void Linking.openURL(webUrl).catch(() => {
      Alert.alert('WhatsApp', `Numéro : +${digits}`);
    });
  }
}

export function openPhoneCallDirect(phone: string): void {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) {
    Alert.alert('Numéro indisponible', 'Aucun numéro de téléphone valide trouvé.');
    return;
  }
  void Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Appel téléphonique', `Numéro : ${cleaned}`);
  });
}

/**
 * Propose à l'utilisateur (Client ou Chauffeur) de contacter via WhatsApp ou Téléphone.
 */
export function openContactPicker(phone: string, title = 'Contacter'): void {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) {
    Alert.alert('Numéro indisponible', 'Aucun numéro de téléphone valide trouvé.');
    return;
  }

  Alert.alert(
    title,
    `Choisissez comment joindre le ${cleaned} :`,
    [
      {
        text: 'WhatsApp',
        onPress: () => {
          void openWhatsAppDirect(cleaned);
        },
      },
      {
        text: 'Téléphone',
        onPress: () => {
          openPhoneCallDirect(cleaned);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ],
  );
}
