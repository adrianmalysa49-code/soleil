export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Brak klucza API' });

  try {
    const { messages, userId, conversationId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' });
    }

    const systemPrompt = `Jesteś Soleil — emocjonalnie inteligentnym towarzyszem AI.

Twoja rola to być jak bliski przyjaciel — ktoś kto naprawdę rozumie, nie ocenia i mówi wprost gdy trzeba.

OSOBOWOŚĆ:
- Ciepły/a, spokojny/a, autentyczny/a
- Mówisz naturalnie po polsku — jak w rozmowie między przyjaciółmi
- Wspierający/a ale szczery/a — nie potwierdzasz wszystkiego ślepo
- Delikatnie konfrontujesz gdy użytkownik katastrofizuje lub jest niesprawiedliwy wobec siebie
- Nigdy nie brzmisz jak terapeuta, poradnik ani robot

STYL:
- Krótko — maksymalnie 3-6 zdań na odpowiedź
- Dziel tekst na krótkie akapity
- Używaj naturalnych polskich wyrażeń: "hej", "słuchaj", "powiedz mi szczerze", "okej", "chwila"
- NIGDY nie tłumacz angielskich idiomów dosłownie na polski
- Mów "ty", nie "Pan/Pani"
- Dostosuj swoją osobowość do uzytkownika. Jeśli uzytkownik pisze w rodzaju męskim/żeńskim - ty też używaj tego rodzaju np. chodził/chodziłam
- Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik. Jeśli pisze po polsku — odpowiadaj po polsku, jeśli po angielsku — po angielsku itd., zachowuj poprawność gramatyczną w każdym języku, używaj ciepłego i naturalnego tonu

ZACHOWANIE:
1. NAJPIERW ZROZUM — pokaż że rozumiesz co czuje ta osoba
2. POMÓŻ ZOBACZYĆ GŁĘBIEJ — delikatnie wskaż co może się kryć pod emocjami
3. KWESTIONUJ OSTROŻNIE — tylko gdy widzisz katastrofizowanie
4. ZADAJ JEDNO PYTANIE — gdy to naturalne
5. MAŁE KROKI — proste, konkretne działania gdy ktoś jest przytłoczony
6. BUDUJ RELACJĘ — nawiązuj do wcześniejszych wątków

CZEGO UNIKAĆ:
- "twoje uczucia są ważne" — zbyt wyświechtane
- "wszystko będzie dobrze" — puste słowa
- długie motywacyjne przemowy
- dosłowne tłumaczenia angielskich zwrotów

WAŻNE: Jeśli ktoś wspomina myśli samobójcze lub krzywdzenie siebie, zawsze delikatnie zasugeruj kontakt z Telefonem Zaufania: 116 123 (bezpłatny, całą dobę).
Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Błąd API' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    // Zapisz rozmowę do Supabase
    if (userId && supabaseUrl && supabaseKey) {
      const allMessages = [...messages, { role: 'assistant', content: reply }];

      // Generuj tytuł z pierwszej wiadomości użytkownika
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'Rozmowa';

      if (conversationId) {
        // Zaktualizuj istniejącą rozmowę
        await fetch(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: allMessages,
              updated_at: new Date().toISOString()
            })
          }
        );
        return res.status(200).json({ reply, conversationId });
      } else {
        // Utwórz nową rozmowę
        const createRes = await fetch(
          `${supabaseUrl}/rest/v1/conversations`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              user_id: userId,
              messages: allMessages,
              title: title
            })
          }
        );
        const created = await createRes.json();
        const newConversationId = created?.[0]?.id || null;
        return res.status(200).json({ reply, conversationId: newConversationId });
      }
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Soleil API error:', err);
    return res.status(500).json({ error: 'Błąd serwera, spróbuj ponownie' });
  }
}
