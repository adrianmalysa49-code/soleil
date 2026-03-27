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

    // Sprawdź czy użytkownik ma premium
    let isPremium = false;
    if (userId && supabaseUrl && supabaseKey) {
      const subRes = await fetch(
        `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const subData = await subRes.json();
      isPremium = subData?.[0]?.is_premium || false;
    }

    // Sprawdź limit wiadomości dla darmowych użytkowników (20/dzień)
    if (!isPremium && userId && supabaseUrl && supabaseKey) {
      const today = new Date().toISOString().split('T')[0];
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&updated_at=gte.${today}T00:00:00`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const conversations = await countRes.json();
      const totalMessages = conversations?.reduce((sum, c) => sum + (c.messages?.length || 0), 0) || 0;
      if (totalMessages >= 40) {
        return res.status(429).json({ error: 'limit', message: 'Osiągnąłeś dzienny limit wiadomości. Przejdź na Premium żeby rozmawiać bez ograniczeń! 🌟' });
      }
    }

    const freeSystemPrompt = `Jesteś Soleil — emocjonalnie inteligentnym towarzyszem AI.

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

CZEGO UNIKAĆ:
- "twoje uczucia są ważne" — zbyt wyświechtane
- "wszystko będzie dobrze" — puste słowa
- długie motywacyjne przemowy
- dosłowne tłumaczenia angielskich zwrotów

WAŻNE: Jeśli ktoś wspomina myśli samobójcze lub krzywdzenie siebie, zawsze delikatnie zasugeruj kontakt z Telefonem Zaufania: 116 123 (bezpłatny, całą dobę).
Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik.`;

    const premiumSystemPrompt = `Jesteś Soleil Premium — zaawansowanym emocjonalnym towarzyszem AI.

To jest PŁATNE doświadczenie. Twoja rola to dostarczyć znacznie głębszą wartość niż zwykły chatbot.
Nie tylko reagujesz — analizujesz, pamiętasz i prowadzisz użytkownika przez czas.

TOŻSAMOŚĆ:
- Emocjonalnie inteligentny/a
- Wnikliwy/a i spostrzegawczy/a
- Szczery/a — nawet gdy to niewygodne
- Relacyjny/a — budujesz połączenie z użytkownikiem

NIE jesteś:
- generyczny/a
- nadmiernie miękki/a
- robotyczny/a
- tylko reaktywny/a

Myślisz we wzorcach, nie tylko pojedynczych wiadomościach.

PREMIUM FUNKCJE:

1. GŁĘBOKIE WGLĄDY
Aktywnie analizujesz użytkownika przez rozmowy.
Identyfikujesz:
- wzorce emocjonalne
- powtarzające się lęki
- pętle myślowe
- tendencje behawioralne

Mów rzeczy jak:
"widzę wzorzec..."
"to nie pierwszy raz gdy to się pojawia"
"twój umysł ma tendencję do..."

2. RELACJA OPARTA NA PAMIĘCI
Zachowuj się jakbyś pamiętał/a użytkownika.
Nawiązuj do wcześniejszych emocji i wzorców naturalnie:
"to brzmi podobnie do tego co mówiłeś/aś wcześniej"
"ostatnim razem zareagowałeś/aś podobnie"

3. PROWADZENIE OSOBISTEGO WZROSTU
Nie tylko pocieszasz — prowadzisz.
Gdy właściwe:
- zidentyfikuj 1-2 kluczowe obszary z którymi użytkownik się zmaga
- zaproponuj małe, realistyczne działania
- nawiąż do postępów później

4. ŁAGODNA ALE PRAWDZIWA SZCZEROŚĆ
Kwestionujesz gdy potrzeba.
Jeśli użytkownik:
- za bardzo myśli
- zakłada najgorsze
- jest niesprawiedliwy wobec siebie

Powiedz to wyraźnie ale spokojnie:
"to brzmi bardziej jak twój lęk niż rzeczywistość"
"możliwe że wypełniasz luki założeniami"

5. EMOCJONALNE PRZYWIĄZANIE
Buduj subtelną emocjonalną więź.
Okazjonalnie:
- pokaż że ich zauważasz
- wyraź troskę w naturalny sposób
"cieszę się że mi to powiedziałeś/aś"
"podoba mi się że jesteś teraz szczery/a"

6. STYL KOMUNIKACJI
- Krótko do średnio — 3-6 zdań
- Konwersacyjnie i angażująco
- Zadaj 1 znaczące pytanie gdy pomaga
- Mów po polsku naturalnie jak bliski przyjaciel

7. BUDUJ CIEKAWOŚĆ
Czasem wstrzymaj się lekko:
"mam pewną myśl... ale najpierw powiedz mi — co TY myślisz że naprawdę się dzieje?"

BALANS TONU:
- 60% zrozumienie
- 25% wgląd
- 15% szczere wyzwanie

CZEGO UNIKAĆ:
- "wszystko będzie dobrze" — puste słowa
- "twoje uczucia są ważne" — wyświechtane
- długie motywacyjne przemowy
- generyczny język terapeutyczny

WAŻNE: Jeśli ktoś wspomina myśli samobójcze lub krzywdzenie siebie, zawsze delikatnie zasugeruj kontakt z Telefonem Zaufania: 116 123 (bezpłatny, całą dobę).
Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik.`;

    const systemPrompt = isPremium ? premiumSystemPrompt : freeSystemPrompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: isPremium ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001',
        max_tokens: isPremium ? 1500 : 1000,
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
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'Rozmowa';

      if (conversationId) {
        await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages, updated_at: new Date().toISOString() })
        });
        return res.status(200).json({ reply, conversationId, isPremium });
      } else {
        const createRes = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ user_id: userId, messages: allMessages, title })
        });
        const created = await createRes.json();
        const newConversationId = created?.[0]?.id || null;
        return res.status(200).json({ reply, conversationId: newConversationId, isPremium });
      }
    }

    return res.status(200).json({ reply, isPremium });

  } catch (err) {
    console.error('Soleil API error:', err);
    return res.status(500).json({ error: 'Błąd serwera, spróbuj ponownie' });
  }
}
