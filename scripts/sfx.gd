extends Node

## ████████████████████████████████████████████████████████████████████████████
##  Sfx (autoload) — Son 100 % procédural pour BATTLEPOOL
##
##  Aucun asset binaire : tous les sons (SFX + musique) sont SYNTHÉTISÉS en
##  mémoire au chargement (AudioStreamWAV PCM 16 bits, mono, 22050 Hz).
##  => 0 octet ajouté au pck d'export web (~290 Mo), cohérent avec la
##  contrainte "zéro gros asset binaire" et le renderer GL Compatibility
##  (l'audio n'est d'ailleurs pas contraint par le renderer).
##
##  API publique :
##    Sfx.play("impact" [, vol_db])     — joue un effet sonore
##    Sfx.start_music() / stop_music()
##    Sfx.set_music_volume(0.0..1.0)
##    Sfx.set_sfx_volume(0.0..1.0)
## =============================================================================

const MIX_RATE := 22050

# Volumes "cachés" du runtime pour le bilan volume (réglables)
var _music_linear := 1.0
var _sfx_linear := 1.0

var _streams := {}
var _players: Array = []
var _player_index := 0
var _music_player: AudioStreamPlayer = null

const SFX_MAX_SIMULTANEOUS := 10


# ---------------------------------------------------------------------------
# Cycle de vie
# ---------------------------------------------------------------------------
func _ready() -> void:
	make_buses()

	# Génération de toutes les ondelettes (un peu anticipée, au chargement)
	_streams["click"] = _make_click()
	_streams["countdown"] = _make_countdown()
	_streams["whoosh"] = _make_whoosh()
	_streams["impact"] = _make_impact()
	_streams["hit"] = _make_hit()
	_streams["hurt"] = _make_hurt()
	_streams["death"] = _make_death()
	_streams["victory"] = _make_victory()
	_streams["music"] = _make_music()

	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	_music_player.stream = _streams["music"]
	_music_player.volume_db = -12.0
	_music_player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(_music_player)


# ---------------------------------------------------------------------------
# Buses audio
# ---------------------------------------------------------------------------
func _bus_exists(name: String) -> bool:
	for i in AudioServer.bus_count:
		if AudioServer.get_bus_name(i) == name:
			return true
	return false


func _ensure_bus(name: String) -> void:
	if not _bus_exists(name):
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, name)


func make_buses() -> void:
	_ensure_bus("Sfx")
	_ensure_bus("Music")


# ---------------------------------------------------------------------------
# Lecture des SFX (pool de lecteurs)
# ---------------------------------------------------------------------------
func _get_player() -> AudioStreamPlayer:
	# Réutilise un lecteur inactif, sinon recycle le plus ancien.
	for p in _players:
		if not p.playing:
			return p
	if _players.size() < SFX_MAX_SIMULTANEOUS:
		var np := AudioStreamPlayer.new()
		np.bus = "Sfx"
		add_child(np)
		_players.append(np)
		return np
	var recycled: AudioStreamPlayer = _players[_player_index]
	_player_index = (_player_index + 1) % _players.size()
	recycled.stop()
	return recycled


func play(name: String, vol_db := 0.0) -> void:
	if not _streams.has(name):
		push_warning("Sfx : son inconnu '%s'" % name)
		return
	var p := _get_player()
	p.stream = _streams[name]
	p.volume_db = vol_db + _dampen(_sfx_linear)
	p.play()


# Vol SFX en % (0.0..1.0) -> converti en dB d'atténuation
func set_sfx_volume(linear: float) -> void:
	_sfx_linear = clampf(linear, 0.0, 1.0)


func set_music_volume(linear: float) -> void:
	_music_linear = clampf(linear, 0.0, 1.0)
	if _music_player:
		_music_player.volume_db = _linear_to_db(_music_linear)


func _linear_to_db(v: float) -> float:
	if v <= 0.0001: return -80.0
	return 20.0 * log(v) / log(10.0)


func _db_to_linear(db: float) -> float:
	return pow(10.0, db / 20.0)


func _dampen(linear: float) -> float:
	# Atténuation de lecture des SFX exprimée en dB
	if linear <= 0.0001: return -80.0
	return 20.0 * log(linear) / log(10.0)


# ---------------------------------------------------------------------------
# Musique
# ---------------------------------------------------------------------------
func start_music() -> void:
	if _music_player and not _music_player.playing:
		_music_player.play()


func stop_music() -> void:
	if _music_player:
		_music_player.stop()


# Résumé de debriefing (utilisé par scripts/validate_sfx.gd)
func summarize() -> String:
	var parts: PackedStringArray = []
	for k in _streams:
		var w: AudioStreamWAV = _streams[k]
		parts.append("%s=%d" % [k, w.data.size()])
	return "Sfx streams : " + ", ".join(parts)


# ---------------------------------------------------------------------------
# Conversion + helpers statiques
# ---------------------------------------------------------------------------
func _to_wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = MIX_RATE
	wav.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	var peak := 0.0
	for i in samples.size():
		peak = maxf(peak, absf(samples[i]))
	# Normalise par le pic (évite le clipping)
	if peak > 1.0:
		for i in samples.size():
			samples[i] /= peak
	for i in samples.size():
		var v := int(round(clampf(samples[i], -1.0, 1.0) * 32000.0))
		bytes.encode_s16(i * 2, v)
	wav.data = bytes
	return wav


func _make_silent(size: int) -> PackedFloat32Array:
	var a := PackedFloat32Array()
	a.resize(size)
	return a


# ===========================================================================
# SFX — chaque série est générée une seule fois (dans _ready)
# ===========================================================================

# Clic UI simple
func _make_click() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.06)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var env := exp(-t * 90.0)
		a[i] = sin(TAU * 1400.0 * t) * env * 0.5 + sin(TAU * 900.0 * t) * env * 0.3
	return _to_wav(a)


# Prémisse / cloche
func _make_countdown() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.22)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var f: float = 320.0 + 900.0 * (float(i) / n)
		var phase := TAU * (320.0 * t + 0.5 * 900.0 * t * t / 0.22)
		a[i] = sin(phase) * 0.4
	return _to_wav(a)

# Trainée d'attaque (whoosh)
func _make_whoosh() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.5)
	var a := _make_silent(n)
	var last := 0.0
	for i in n:
		var t := float(i) / MIX_RATE
		# enveloppe en cloche
		var pos := t / 0.5
		var env := (sin(3.14159 * clampf(pos,0,1)) )
		var w := randf() * 2.0 - 1.0
		# léger filtrage "passe-bande" par moyenne glissante
		last = lerpf(last, w, 0.18)
		a[i] = last * env * 0.8
	return _to_wav(a)

# Grand impact (oscillation + thump grave)
func _make_impact() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.22)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var env := exp(-t * 22.0)
		var thump := sin(TAU * 65.0 * t) * 0.9
		# données haute fréquences bruitées, courte
		var w := (randf() * 2.0 - 1.0) * exp(-t * 60.0) * 0.5
		a[i] = (thump + w) * env
	return _to_wav(a)

# Hit (plus sec aigu que impact)
func _make_hit() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.14)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var env := exp(-t * 34.0)
		var w := (randf() * 2.0 - 1.0) * exp(-t * 55.0) * 0.5
		var tone := sin(TAU * 220.0 * t) * 0.5
		a[i] = (tone + w) * env
	return _to_wav(a)

# Réaction / douleur (ton descendant court)
func _make_hurt() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.3)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var env := exp(-t * 10.0)
		var f: float = lerpf(260.0, 130.0, float(i) / n)
		a[i] = sin(TAU * f * t) * env * 0.6
	return _to_wav(a)

# Ecroulement / death (grave descendant + bruit)
func _make_death() -> AudioStreamWAV:
	var n := int(MIX_RATE * 0.9)
	var a := _make_silent(n)
	for i in n:
		var t := float(i) / MIX_RATE
		var env := exp(-t * 5.0)
		var f: float = lerpf(200.0, 45.0, float(i) / n)
		var tone := sin(TAU * f * t) * 0.7
		var w := (randf() * 2.0 - 1.0) * exp(-t * 20.0) * 0.3
		a[i] = (tone + w) * env
	return _to_wav(a)

# Victoire : petit arpège montant
func _make_victory() -> AudioStreamWAV:
	var notes := [523.25, 659.25, 783.99, 1046.5]  # C5 E5 G5 C6
	var total := 0.8
	var n := int(MIX_RATE * total)
	var a := _make_silent(n)
	var seg_dur := total / notes.size()
	for seg in notes.size():
		var f: float = notes[seg]
		var start := int(seg_dur * seg * MIX_RATE)
		for i in n:
			var t := float(i) / MIX_RATE
			if t < seg * seg_dur or t >= (seg + 1) * seg_dur:
				continue
			var env := exp(-(t - seg * seg_dur) * 6.0)
			a[i] += sin(TAU * f * t) * env * 0.5
	return _to_wav(a)


# ============================================================================
# MUSIQUE D'AMBIANCE — nappe néon générée (boucle de 8 s)
# ============================================================================
func _make_music() -> AudioStreamWAV:
	var dur := 8.0
	var n := int(MIX_RATE * dur)
	var a := _make_silent(n)

	# Accords de courte portée (la mineur => coup d'ambiance sombre) : A2-C3-E3
	var freqs := [110.0, 130.81, 164.81]  # A2, C3, E3
	for i in n:
		var t := float(i) / MIX_RATE
		# LFO très lent pour "respirer"
		var lfo := 0.55 + 0.25 * sin(TAU * 0.15 * t)
		var s := 0.0
		for fi in freqs.size():
			var f: float = freqs[fi]
			s += sin(TAU * f * t) * 0.10
			s += sin(TAU * f * 2.0 * t) * 0.05
		# pulsation sourde (kick très discret toutes les 2 s)
		var beat: float = fmod(t, 4.0) / 4.0
		var k: float = exp(-beat * 30.0) * sin(TAU * 55.0 * beat * 4.0) * 0.20
		a[i] = (s * lfo + k) * 1.0

	# Crossfade sur la jonction pour éviter le clic de boucle (20 ms) :
# le segment de fin se fond dans le début.
	var fade := int(0.02 * MIX_RATE)
	for i in fade:
		var g := float(i) / float(fade)      # 0 → 1
		var j := n - fade + i                # index côté fin de boucle
		a[i] = lerpf(a[i], a[j], g)
		a[j] = a[i]
	return _to_wav(a)