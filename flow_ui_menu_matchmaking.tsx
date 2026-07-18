import React, { useState, useEffect } from 'react';
import { Search, QrCode, Swords, Trophy, User, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('character_select');
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [challengeStatus, setChallengeStatus] = useState(null); // null, 'waiting', 'accepted'
  
  // Mock data
  const characters = [
    { id: 1, name: 'Kachujin', style: 'Arts Martiaux', color: 'bg-orange-500' },
    { id: 2, name: 'Cyber-Ninja', style: 'Vitesse', color: 'bg-blue-500' },
    { id: 3, name: 'Goliath', style: 'Force Brute', color: 'bg-red-600' },
    { id: 4, name: 'Valkyrie', style: 'Magie', color: 'bg-purple-500' }
  ];

  const onlinePlayers = [
    { id: '0x1A4...9F2', name: 'CryptoFighter99', rank: 'Or', status: 'En ligne' },
    { id: '0x8B2...4E1', name: 'AbidjanBoss', rank: 'Platine', status: 'En ligne' },
    { id: '0x3C9...7D4', name: 'ShadowNinja', rank: 'Argent', status: 'En ligne' }
  ];

  const brLobbies = [
    { id: 1, name: 'Tournoi Alpha', players: 14, max: 16, entry: 'Gratuit' },
    { id: 2, name: 'Deathmatch Express', players: 3, max: 8, entry: 'VIP' },
    { id: 3, name: 'Championnat Web3', players: 31, max: 32, entry: 'Premium' }
  ];

  // Simulation d'attente de défi
  const handleChallenge = (player) => {
    setChallengeStatus('waiting');
    setTimeout(() => {
      setChallengeStatus('accepted');
      setTimeout(() => {
        setCurrentScreen('combat_simulation');
        setChallengeStatus(null);
      }, 1500);
    }, 2000);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'character_select':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-2">Choisis ton Combattant</h1>
            <p className="text-gray-400 mb-8">Ce choix sera sauvegardé pour tes prochaines sessions.</p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    selectedCharacter?.id === char.id 
                      ? 'border-yellow-400 bg-gray-800 scale-105' 
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <div className={`w-16 h-16 mx-auto rounded-full mb-3 ${char.color} flex items-center justify-center`}>
                    <User size={32} className="text-white opacity-75" />
                  </div>
                  <h3 className="font-bold text-white">{char.name}</h3>
                  <p className="text-xs text-gray-400">{char.style}</p>
                </button>
              ))}
            </div>

            <button 
              disabled={!selectedCharacter}
              onClick={() => setCurrentScreen('main_menu')}
              className={`mt-10 px-8 py-3 rounded-full font-bold text-lg transition-all ${
                selectedCharacter 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Confirmer et Jouer
            </button>
          </div>
        );

      case 'main_menu':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
            <div className="absolute top-4 right-4 flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-full">
               <div className={`w-6 h-6 rounded-full ${selectedCharacter?.color}`}></div>
               <span className="text-white font-medium text-sm">{selectedCharacter?.name}</span>
            </div>

            <h1 className="text-4xl font-black text-white mb-10 tracking-wider">SÉLECTION DU MODE</h1>
            
            <div className="flex flex-col space-y-6 w-full max-w-sm">
              <button 
                onClick={() => setCurrentScreen('duel_lobby')}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-900 p-1"
              >
                <div className="flex items-center justify-between bg-gray-900 px-6 py-8 rounded-xl transition-all group-hover:bg-opacity-80">
                  <div className="text-left">
                    <h2 className="text-2xl font-bold text-white mb-1">MODE DUEL</h2>
                    <p className="text-red-400 text-sm">1 vs 1 en direct</p>
                  </div>
                  <Swords size={40} className="text-red-500 group-hover:scale-110 transition-transform" />
                </div>
              </button>

              <button 
                onClick={() => setCurrentScreen('br_lobby')}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-700 p-1"
              >
                <div className="flex items-center justify-between bg-gray-900 px-6 py-8 rounded-xl transition-all group-hover:bg-opacity-80">
                  <div className="text-left">
                    <h2 className="text-2xl font-bold text-white mb-1">BATTLE ROYALE</h2>
                    <p className="text-yellow-400 text-sm">Tournoi à élimination</p>
                  </div>
                  <Trophy size={40} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        );

      case 'duel_lobby':
        return (
          <div className="flex flex-col h-full p-6 animate-fade-in">
            <button onClick={() => setCurrentScreen('main_menu')} className="flex items-center text-gray-400 hover:text-white mb-6">
              <ArrowLeft size={20} className="mr-2" /> Retour
            </button>
            
            <h1 className="text-2xl font-bold text-white mb-6">Trouver un Adversaire</h1>
            
            {/* Search Bar */}
            <div className="flex space-x-2 mb-8">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-3 top-3 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Pseudo ou Adresse Wallet..." 
                  className="w-full bg-gray-800 text-white rounded-lg py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-red-500 border border-gray-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-white">
                <QrCode size={24} />
              </button>
            </div>

            {/* Online Players List */}
            <h2 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Joueurs en ligne</h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {onlinePlayers.map((player, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">{player.name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">{player.id}</p>
                  </div>
                  
                  {challengeStatus === 'waiting' ? (
                    <button disabled className="bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-300 flex items-center">
                      <Loader2 size={16} className="animate-spin mr-2" /> Attente...
                    </button>
                  ) : challengeStatus === 'accepted' ? (
                    <button disabled className="bg-green-600 px-4 py-2 rounded-lg text-sm text-white flex items-center">
                      <CheckCircle2 size={16} className="mr-2" /> Accepté !
                    </button>
                  ) : (
                    <button onClick={() => handleChallenge(player)} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors">
                      Défier
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'br_lobby':
        return (
          <div className="flex flex-col h-full p-6 animate-fade-in">
            <button onClick={() => setCurrentScreen('main_menu')} className="flex items-center text-gray-400 hover:text-white mb-6">
              <ArrowLeft size={20} className="mr-2" /> Retour
            </button>
            
            <h1 className="text-2xl font-bold text-white mb-2">Salons Battle Royale</h1>
            <p className="text-gray-400 mb-6">Rejoins un tournoi en attente. Le combat commence quand le salon est plein.</p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {brLobbies.map((lobby) => {
                const isFull = lobby.players >= lobby.max;
                const progress = (lobby.players / lobby.max) * 100;
                
                return (
                  <div key={lobby.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 bg-gray-700 w-full">
                      <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-white">{lobby.name}</h3>
                        <span className="inline-block mt-1 text-xs px-2 py-1 bg-gray-900 rounded text-gray-400 border border-gray-700">
                          {lobby.entry}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">{lobby.players}</span>
                        <span className="text-gray-500">/{lobby.max}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setCurrentScreen('combat_simulation')}
                      disabled={isFull}
                      className={`w-full py-3 rounded-lg font-bold transition-colors ${
                        isFull 
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                          : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                      }`}
                    >
                      {isFull ? 'Salon Complet' : 'Rejoindre la file'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'combat_simulation':
        return (
          <div className="flex flex-col items-center justify-center h-full p-6 bg-black text-center animate-fade-in">
            <Swords size={64} className="text-red-500 mb-6 animate-pulse" />
            <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Godot Engine</h1>
            <p className="text-gray-400 mb-8">Chargement de la scène 3D de combat...</p>
            
            <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 animate-[loading_2s_ease-in-out_infinite]"></div>
            </div>

            <button 
              onClick={() => setCurrentScreen('main_menu')}
              className="mt-12 text-gray-500 hover:text-white underline text-sm"
            >
              Retourner au menu (Mode Test)
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-black font-sans">
      {/* Simulation d'un écran de smartphone */}
      <div className="w-full max-w-[400px] h-[800px] bg-gray-950 border-[8px] border-gray-900 rounded-[3rem] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Notch simulation */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
           <div className="w-32 h-6 bg-gray-900 rounded-b-2xl"></div>
        </div>
        
        {/* Main Content */}
        <div className="h-full pt-8 pb-4">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}