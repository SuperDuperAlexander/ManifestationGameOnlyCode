# Gestaltungsentwürfe – aktueller Prototyp

**Status: Entwürfe, keine zusätzlichen festen Regeln.** Diese Übersicht hält fest, wie die jüngste spielbare Fassung derzeit aussieht und welche Präsentationsideen erprobt wurden. Alexander kann jeden hier beschriebenen UI-, Text-, Timing- oder Look-Entwurf ändern oder verwerfen. Ein vorhandener Prototyp und ein bestandener Check bedeuten keine gestalterische Abnahme.

Die bestehenden Kerngedanken der Geschichte bleiben davon getrennt: Wut wird verwandelt, der Imp ist kein Gegner, Atem lässt Gedankenblasen vorbeiziehen, Wegschieben verstärkt sie, und innere wie äußere Schritte gehören zur Geschichte. Diese Übersicht ändert diese Grundlagen nicht.

## Entwürfe für Bedienung und Orientierung

- **Start und Menü:** Die aktuelle Oberfläche probiert warme Papierfarben, Georgia- und Work-Sans-Schrift, eine Szene hinter dem Startmenü, helle Aktionsfelder und ein dauerhaft erreichbares Menü. Escape, Schließen und Zurück führen aus dem Menü. Desktop, Hoch- und Querformat am Telefon haben eigene Anordnungen. Das sind Stil- und Layoutversuche aus der UI-Referenz, keine endgültige Gestaltung.
- **Atemdarstellung:** Lichtpartikel bewegen sich bei Ein- und Ausatmen nach innen, mit leicht unterschiedlicher Bewegung. Im Menü lassen sich Ein- und Ausatemdauer unabhängig auf 1, 2, 3 oder 4 Sekunden stellen; der Prototyp startet bei je 2 Sekunden und merkt sich die Wahl lokal. Partikelform, Rhythmus und Einstellungsbedienung bleiben offen.
- **Bewegungsbezogene Hinweise:** Der Prototyp reagiert auf Bewegung, Atem, Ankunft und Weltwechsel. Er zeigt das nächste Ziel mit einem goldenen Lichtpunkt und bei Bedarf einem Richtungsmarker. Auf dem Platz gibt es einen Rückkehr-Zielpunkt im Bereich des Auslösers; danach zeigt die Orientierung zur Gasse. Reihenfolge, Sichtbarkeit und Häufigkeit der Hinweise sind Entwurfsfragen.
- **Aktion am Apfel:** In Reichweite eines sammelbaren Apfels zeigt die Aktionsfläche „Collect apple“ mit einem Apfelsymbol; sonst erscheint die zum Kontext passende Aktion. Das ist ein Test für kontextabhängige Beschriftung und kann anders gelöst werden.
- **Push und Atmen:** Ein neuer Gedankenballon kann einen kurzen Push-Hinweis auslösen. Der aktuelle Interface-Entwurf zeigt Push away und Atmen zugleich und zentral als zwei verfügbare Möglichkeiten. Auf Touch erscheint ein Tap-Hinweis. Position, Stärke, Text und Verhalten bei reduzierter Bewegung sind noch veränderbar.
- **Richtung für den Weltwechsel:** Q und das Diamant-Symbol zeigen im Dorf „Go Inside“ und innen „Go Outside“. Beim Eintritt in die Innenwelt richtet die Kamera ihren Blick zunächst auf den sichtbaren Wut-Imp; Bewegung oder Kameraziehen lösen diese Ausrichtung. Beschriftung und Kameraführung sind Prototypentscheidungen.

## Entwürfe für Spielrückmeldung und Figuren

- **Finale mit dem Imp:** Aus der Nähe zeigt der Prototyp den Atemfortschritt als Zahl, Fortschrittszeichen und verbleibende Atemzüge. Weiter entfernt probiert er zuerst einen Hinweis zum Näherkommen, Hinschauen und Wahrnehmen der Wut. Diese Textfassung ist ein Entwurf; auch Form und Abstand der Anzeige bleiben offen.
- **Wut-Impuls und Gedankenrhythmus:** Die aktuelle Fassung verbindet Push-Rückmeldung mit einem tatsächlich erreichbaren Gedankenballon. Die automatischen Gedanken erscheinen seltener als in der früheren Fassung; die genaue Häufigkeit und das Verhältnis von Push-, Atem- und Gedankenhinweisen bleiben abstimmbar.
- **Dorfbewohner:** Der Prototyp variiert Kleidung und Farben, zeigt Frauen und Männer sowie unterschiedliche Haarformen. Eine Fackel wird mit gebeugtem Arm neben dem Gesicht getragen; eine beruhigte Figur senkt den Arm, während die Fackel sanft weiterbrennt. Das sind Varianten der Darstellung. Kleidung bedeutet weiterhin nicht gut oder böse.

## Entwürfe für den Abschluss

- **Laterne am Alten Baum:** Der aktuelle Prototyp hängt die übergebene Laterne groß an einer codegebauten Halterung und beleuchtet den Bereich mit warmem Licht. Größe, Halterung und Lichtwirkung sind Vorschläge zum Prüfen.
- **Abschlussbild und Weiterspielen:** Ein goldenes Lichttor erinnert im Prototyp an das frühere Tor-Ende. Eine Abschlussanzeige nennt das abgeschlossene Kapitel und bietet das Weiterspielen an; danach kann man in der fertigen Welt weitergehen und nach innen sehen. Bild, Ablauf und Text können überarbeitet werden. Die Geschichte benötigt dadurch keine neue Aufgabe.

Die passenden Umsetzungseinträge stehen in [`DECISIONS.md`](DECISIONS.md), zuletzt L38. Die Lampen- und Abschlussbild-Notiz in Abschnitt 7.7 von [`GAME_DESIGN.md`](GAME_DESIGN.md) ist ebenfalls als Darstellungsvorschlag markiert.
