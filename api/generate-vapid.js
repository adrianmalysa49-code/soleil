import webpush from 'web-push';

export default function handler(req, res) {
  const vapidKeys = webpush.generateVAPIDKeys();
  return res.status(200).json(vapidKeys);
}
