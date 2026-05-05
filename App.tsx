import React, { useCallback, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Dimensions,
  Alert,
  Modal,
  Switch,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons, Entypo, FontAwesome } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';
import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Calendar } from 'react-native-calendars';
import { 
  SafeAreaProvider, 
  useSafeAreaInsets 
} from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from './constants/theme';

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

type TabType = 'TRADES' | 'TARGET' | 'STATISTICS' | 'SETTINGS' | 'ADD_TRADE' | 'CALENDAR';

interface Trade {
  id: string;
  type: 'Profit' | 'Loss';
  amount: number;
  date: string;
  time: string;
  pair: string;
  note?: string;
}

interface Targets {
  Daily: number;
  Monthly: number;
  Custom: number;
}

interface PropFirmChallenge {
  accountSize: number;
  profitTargetPct: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  minTradingDays: number;
  phase: '1' | '2';
  startDate: string;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('TRADES');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [tradeType, setTradeType] = useState<'Profit' | 'Loss'>('Profit');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedDate, setSelectedDate] = useState('2026-05-02');
  const [targets, setTargets] = useState<Targets>({ Daily: 0, Monthly: 0, Custom: 0 });
  const [propFirm, setPropFirm] = useState<PropFirmChallenge | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Handle Auth State
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  // Load data on mount (only if logged in)
  React.useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;
    
    const loadData = async () => {
      try {
        // Load Trades
        const { data: tradesData } = await supabase
          .from('trades')
          .select('*')
          .order('date', { ascending: false });
        if (tradesData) setTrades(tradesData);

        // Load Targets
        const { data: targetsData } = await supabase
          .from('targets')
          .select('*')
          .limit(1);
        if (targetsData && targetsData.length > 0) {
          setTargets({
            Daily: targetsData[0].daily_target,
            Monthly: targetsData[0].monthly_target,
            Custom: targetsData[0].custom_target
          });
        }

        // Load Prop Firm
        const { data: pfData } = await supabase
          .from('prop_firm')
          .select('*')
          .limit(1);
        if (pfData && pfData.length > 0) {
          setPropFirm({
            accountSize: pfData[0].account_size,
            profitTargetPct: pfData[0].profit_target_pct,
            maxDailyLossPct: pfData[0].max_daily_loss_pct,
            maxDrawdownPct: pfData[0].max_drawdown_pct,
            minTradingDays: pfData[0].min_trading_days,
            phase: pfData[0].phase,
            startDate: pfData[0].start_date
          });
        }
      } catch (e) {
        console.warn('Initial load from Supabase failed or empty', e);
      }
    };
    loadData();
  }, [session]);

  // Helper to ensure Supabase is configured
  const isSupabaseConfigured = () => {
    return supabase.supabaseUrl !== 'YOUR_SUPABASE_URL' && supabase.supabaseKey !== 'YOUR_SUPABASE_ANON_KEY';
  };

  // Update Targets in Supabase
  const updateTargets = async (newTargets: React.SetStateAction<Targets>) => {
    const resolvedTargets = typeof newTargets === 'function' ? newTargets(targets) : newTargets;
    setTargets(resolvedTargets);
    
    if (session?.user?.id && isSupabaseConfigured()) {
      const { error } = await supabase
        .from('targets')
        .upsert({
          user_id: session.user.id,
          daily_target: resolvedTargets.Daily,
          monthly_target: resolvedTargets.Monthly,
          custom_target: resolvedTargets.Custom,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) console.error('Error syncing targets', error);
    }
  };

  // Update Prop Firm in Supabase
  const updatePropFirm = async (pf: React.SetStateAction<PropFirmChallenge | null>) => {
    const resolvedPf = typeof pf === 'function' ? pf(propFirm) : pf;
    setPropFirm(resolvedPf);
    
    if (session?.user?.id && isSupabaseConfigured()) {
      if (resolvedPf) {
        const { error } = await supabase
          .from('prop_firm')
          .upsert({
            user_id: session.user.id,
            account_size: resolvedPf.accountSize,
            profit_target_pct: resolvedPf.profitTargetPct,
            max_daily_loss_pct: resolvedPf.maxDailyLossPct,
            max_drawdown_pct: resolvedPf.maxDrawdownPct,
            min_trading_days: resolvedPf.minTradingDays,
            phase: resolvedPf.phase,
            start_date: resolvedPf.startDate,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        
        if (error) console.error('Error syncing prop firm', error);
      } else {
        await supabase.from('prop_firm').delete().eq('user_id', session.user.id);
      }
    }
  };

  const resetPropFirm = () => {
    Alert.alert(
      "Reset Challenge",
      "Are you sure you want to reset your prop firm challenge? This will clear all rules and progress.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => updatePropFirm(null) }
      ]
    );
  };

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const handleSaveTrade = async (newTrade: Omit<Trade, 'id'>) => {
    if (!isSupabaseConfigured()) {
      // Local fallback if keys are missing
      const tradeWithId = { ...newTrade, id: Math.random().toString(36).substr(2, 9) };
      setTrades([tradeWithId, ...trades]);
      setActiveTab('TRADES');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('trades')
        .insert([newTrade])
        .select();

      if (error) throw error;
      if (data) {
        setTrades([data[0], ...trades]);
        setActiveTab('TRADES');
      }
    } catch (e: any) {
      console.error('Error saving trade to Supabase', e);
      Alert.alert('Error', e.message || 'Failed to save trade to cloud.');
    }
  };

  const renderContent = () => {
    if (authLoading) return <View style={styles.placeholderContainer}><Text>Loading...</Text></View>;
    if (!session) return <AuthScreen />;

    switch (activeTab) {
      case 'TRADES':
        return (
          <TradesScreen 
            trades={trades}
            targets={targets}
            onAdd={() => setActiveTab('ADD_TRADE')} 
            onFlash={() => {
              setActiveTab('ADD_TRADE');
              setShowTypeModal(true);
            }} 
            onCalendar={() => setActiveTab('CALENDAR')}
          />
        );
      case 'CALENDAR':
        return (
          <CalendarScreen 
            trades={trades}
            onBack={() => setActiveTab('TRADES')}
            onAddForDate={(date) => {
              setSelectedDate(date);
              setActiveTab('ADD_TRADE');
            }}
          />
        );
      case 'ADD_TRADE':
        return (
          <AddTradeScreen 
            onBack={() => setActiveTab('TRADES')} 
            onSave={handleSaveTrade}
            tradeType={tradeType}
            setTradeType={setTradeType}
            showTypeModal={showTypeModal}
            setShowTypeModal={setShowTypeModal}
            initialDate={selectedDate}
          />
        );
      case 'TARGET':
        return <TargetScreen targets={targets} setTargets={updateTargets} trades={trades} propFirm={propFirm} setPropFirm={updatePropFirm} onResetPropFirm={resetPropFirm} />;
      case 'STATISTICS':
        return <StatisticsScreen trades={trades} />;
      case 'SETTINGS':
        return <SettingsScreen userEmail={session?.user?.email || ''} onLogout={() => supabase.auth.signOut()} />;
      default:
        return <TradesScreen />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} onLayout={onLayoutRootView}>
      <StatusBar style="dark" />
      
      {renderContent()}

      {/* Bottom Tab Bar */}
      {session && activeTab !== 'ADD_TRADE' && activeTab !== 'CALENDAR' && (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
          <TabItem 
            icon="home-variant" 
            label="TRADES" 
            active={activeTab === 'TRADES'} 
            onPress={() => setActiveTab('TRADES')}
            provider="MaterialCommunityIcons"
          />
          <TabItem 
            icon="target" 
            label="TARGET" 
            active={activeTab === 'TARGET'} 
            onPress={() => setActiveTab('TARGET')}
            provider="MaterialCommunityIcons"
          />
          <TabItem 
            icon="view-grid-outline" 
            label="STATISTICS" 
            active={activeTab === 'STATISTICS'} 
            onPress={() => setActiveTab('STATISTICS')}
            provider="MaterialCommunityIcons"
          />
          <TabItem 
            icon="cog-outline" 
            label="SETTINGS" 
            active={activeTab === 'SETTINGS'} 
            onPress={() => setActiveTab('SETTINGS')}
            provider="MaterialCommunityIcons"
          />
        </View>
      )}
    </View>
  );
}

function ProgressBar({ current, target, color = COLORS.primary }: { current: number, target: number, color?: string }) {
  if (target <= 0) return null;
  const progress = Math.min(Math.max(current / target, 0), 1);
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function TradesScreen({ 
  trades, 
  targets,
  onAdd, 
  onFlash,
  onCalendar
}: { 
  trades: Trade[], 
  targets: Targets,
  onAdd: () => void, 
  onFlash: () => void,
  onCalendar: () => void
}) {
  const insets = useSafeAreaInsets();
  const todayDate = new Date().toISOString().split('T')[0]; 
  const displayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });  
  const totalBalance = trades.reduce((acc, trade) => {
    return trade.type === 'Profit' ? acc + trade.amount : acc - trade.amount;
  }, 0);

  const todayTrades = trades.filter(t => t.date === todayDate);
  const todayBalance = todayTrades.reduce((acc, t) => t.type === 'Profit' ? acc + t.amount : acc - t.amount, 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Home</Text>
          <Text style={styles.headerSubtitle}>{displayDate}</Text>
        </View>
        <TouchableOpacity style={styles.headerMenuButton}>
          <Ionicons name="menu" size={28} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* This Month Card */}
        <View style={styles.monthCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>This month</Text>
            {targets.Monthly > 0 && (
              <Text style={styles.targetInfoText}>Goal: ${targets.Monthly}</Text>
            )}
          </View>
          <Text style={styles.monthBalance}>$ {totalBalance.toFixed(2)}</Text>
          {targets.Monthly > 0 && (
            <View style={{ marginTop: 10 }}>
              <ProgressBar current={totalBalance} target={targets.Monthly} />
              <Text style={styles.progressPercentage}>
                {Math.round(Math.min(totalBalance / targets.Monthly, 1) * 100)}% of goal
              </Text>
            </View>
          )}
        </View>

        {/* Calendar View Button */}
        <TouchableOpacity style={styles.calendarButton} onPress={onCalendar}>
          <View style={styles.calendarLeft}>
            <View style={styles.calendarIconBg}>
              <Ionicons name="calendar" size={18} color={COLORS.white} />
            </View>
            <Text style={styles.calendarText}>Calendar View</Text>
          </View>
          <Entypo name="chevron-right" size={20} color={COLORS.white} />
        </TouchableOpacity>

        {/* Today's Entry with Progress */}
        <View style={styles.dailyCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.dailyDate}>Today - {displayDate}</Text>
            {targets.Daily > 0 && (
              <Text style={styles.targetInfoText}>Goal: ${targets.Daily}</Text>
            )}
          </View>
          <Text style={[styles.dailyBalance, { color: todayBalance >= 0 ? COLORS.primary : COLORS.error }]}>
            $ {todayBalance.toFixed(2)}
          </Text>
          
          {targets.Daily > 0 && (
            <View style={{ marginBottom: 15 }}>
              <ProgressBar 
                current={todayBalance} 
                target={targets.Daily} 
                color={todayBalance >= targets.Daily ? COLORS.success : COLORS.primary} 
              />
              <Text style={styles.progressPercentage}>
                {Math.round(Math.min(todayBalance / targets.Daily, 1) * 100)}% of daily goal
              </Text>
            </View>
          )}

          <View style={styles.badgeContainer}>
            <View style={[styles.badge, styles.successBadge]}>
              <Ionicons name="happy-outline" size={16} color={COLORS.success} />
              <Text style={[styles.badgeText, { color: COLORS.success }]}>
                {todayTrades.filter(t => t.type === 'Profit').reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.badge, styles.errorBadge]}>
              <Ionicons name="sad-outline" size={16} color={COLORS.error} />
              <Text style={[styles.badgeText, { color: COLORS.error }]}>
                - {todayTrades.filter(t => t.type === 'Loss').reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Trades Header */}
        {trades.length > 0 && (
          <Text style={[styles.cardLabel, { marginBottom: 15, marginTop: 10 }]}>Recent Trades</Text>
        )}

        {/* Render dynamic trades */}
        {trades.map((trade) => (
          <View key={trade.id} style={[styles.dailyCard, { paddingVertical: 12 }]}>
            <View style={styles.tradeCardHeader}>
              <Text style={styles.tradeDateSmall}>{trade.date} • {trade.time}</Text>
              <Text style={styles.tradePairText}>{trade.pair}</Text>
            </View>
            <View style={styles.tradeCardMain}>
               <Text style={[
                styles.tradeAmountSmall, 
                { color: trade.type === 'Profit' ? COLORS.success : COLORS.error }
              ]}>
                {trade.type === 'Profit' ? '+' : '-'} $ {trade.amount.toFixed(2)}
              </Text>
              <View style={[styles.badge, trade.type === 'Profit' ? styles.successBadge : styles.errorBadge, { flex: 0, paddingHorizontal: 10 }]}>
                <Text style={[styles.badgeText, { color: trade.type === 'Profit' ? COLORS.success : COLORS.error }]}>
                  {trade.type}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Footer spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={[styles.fabContainer, { bottom: 20 }]}>
        <TouchableOpacity 
          style={[styles.fab, styles.fabPlus]}
          activeOpacity={0.8}
          onPress={onAdd}
        >
          <Ionicons name="add" size={32} color={COLORS.white} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.fab, styles.fabFlash]}
          activeOpacity={0.8}
          onPress={onFlash}
        >
          <MaterialCommunityIcons name="flash" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddTradeScreen({ 
  onBack, 
  onSave,
  tradeType, 
  setTradeType,
  showTypeModal,
  setShowTypeModal,
  initialDate
}: { 
  onBack: () => void, 
  onSave: (t: Omit<Trade, 'id'>) => void,
  tradeType: 'Profit' | 'Loss',
  setTradeType: (t: 'Profit' | 'Loss') => void,
  showTypeModal: boolean,
  setShowTypeModal: (s: boolean) => void,
  initialDate: string
}) {
  const [pair, setPair] = useState('');
  const [margin, setMargin] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    if (!amount) {
      Alert.alert('Error', 'Please enter an amount.');
      return;
    }
    
    onSave({
      type: tradeType,
      amount: parseFloat(amount) || 0,
      date: initialDate,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 
      pair: pair || 'N/A',
      note: note
    });
  };

  return (
    <View style={styles.addTradeContainer}>
      {/* Header */}
      <View style={styles.addTradeHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.addTradeTitle}>Add a Trade</Text>
      </View>

      <ScrollView contentContainerStyle={styles.addTradeContent} showsVerticalScrollIndicator={false}>
        {/* Type Toggle */}
        <View style={styles.typeToggleContainer}>
          <TouchableOpacity 
            style={[styles.typeToggle, tradeType === 'Profit' && styles.typeToggleActiveProfit]}
            onPress={() => setTradeType('Profit')}
          >
            <Text style={[styles.typeToggleText, tradeType === 'Profit' && styles.typeToggleTextActive]}>Profit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeToggle, tradeType === 'Loss' && styles.typeToggleActiveLoss]}
            onPress={() => setTradeType('Loss')}
          >
            <Text style={[styles.typeToggleText, tradeType === 'Loss' && styles.typeToggleTextActive]}>Loss</Text>
          </TouchableOpacity>
        </View>

        {/* Date & Time Row */}
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: SPACING.sm }]}>
            <Text style={styles.inputLabel}>Date *</Text>
            <View style={styles.inputField}>
              <Text style={styles.inputText}>{initialDate}</Text>
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.sm }]}>
            <Text style={styles.inputLabel}>Time *</Text>
            <View style={styles.inputField}>
              <Text style={styles.inputText}>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        </View>

        {/* Trading Pair & Margin Row */}
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: SPACING.sm }]}>
            <TextInput 
              style={styles.inputField} 
              placeholder="Trading Pair" 
              placeholderTextColor={COLORS.textMuted} 
              value={pair}
              onChangeText={setPair}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.sm }]}>
            <TextInput 
              style={styles.inputField} 
              placeholder="Margin/Strike" 
              placeholderTextColor={COLORS.textMuted} 
              value={margin}
              onChangeText={setMargin}
            />
          </View>
        </View>

        {/* Note */}
        <View style={styles.inputGroup}>
          <TextInput 
            style={[styles.inputField, { height: 80, textAlignVertical: 'top' }]} 
            placeholder="Note" 
            placeholderTextColor={COLORS.textMuted}
            multiline
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Amount */}
        <View style={styles.inputGroup}>
          <View style={styles.amountInputContainer}>
            <TextInput 
              style={[styles.inputField, { flex: 1 }]} 
              placeholder="Amount *" 
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity style={styles.calcButton}>
              <MaterialCommunityIcons name="calculator-variant" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Images */}
        <View style={styles.inputGroup}>
          <Text style={styles.imageSectionTitle}>Images (0/3)</Text>
          <TouchableOpacity style={styles.addImagePlaceholder}>
            <MaterialCommunityIcons name="camera-plus-outline" size={32} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Select Type Modal */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTypeModal(false)}
        >
          <View style={styles.bottomSheet}>
            <Text style={styles.modalTitle}>Select a type</Text>
            
            <TouchableOpacity 
              style={[styles.modalItem, { backgroundColor: COLORS.successBg }]}
              onPress={() => {
                setTradeType('Profit');
                setShowTypeModal(false);
              }}
            >
              <View style={styles.modalItemLeft}>
                <Ionicons name="happy-outline" size={24} color={COLORS.success} />
                <Text style={[styles.modalItemText, { color: COLORS.success }]}>Profit</Text>
              </View>
              <Entypo name="chevron-right" size={20} color={COLORS.success} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalItem, { backgroundColor: COLORS.errorBg }]}
              onPress={() => {
                setTradeType('Loss');
                setShowTypeModal(false);
              }}
            >
              <View style={styles.modalItemLeft}>
                <Ionicons name="sad-outline" size={24} color={COLORS.error} />
                <Text style={[styles.modalItemText, { color: COLORS.error }]}>Loss</Text>
              </View>
              <Entypo name="chevron-right" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function TabItem({ 
  icon, 
  label, 
  active, 
  onPress,
  provider = 'Ionicons'
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  onPress: () => void,
  provider?: 'Ionicons' | 'MaterialCommunityIcons'
}) {
  const IconComponent = provider === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
  
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <IconComponent 
        name={icon} 
        size={24} 
        color={active ? COLORS.primary : COLORS.textMuted} 
      />
      <Text style={[
        styles.tabLabel, 
        { color: active ? COLORS.primary : COLORS.textMuted }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CalendarScreen({ 
  trades, 
  onBack, 
  onAddForDate 
}: { 
  trades: Trade[], 
  onBack: () => void, 
  onAddForDate: (date: string) => void 
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('');

  const markedDates = trades.reduce((acc: any, trade) => {
    acc[trade.date] = { 
      marked: true, 
      dotColor: trade.type === 'Profit' ? COLORS.success : COLORS.error 
    };
    return acc;
  }, {});

  if (selected) {
    markedDates[selected] = { ...markedDates[selected], selected: true, selectedColor: COLORS.primary };
  }

  const selectedDateTrades = trades.filter(t => t.date === selected);

  return (
    <View style={styles.calendarContainer}>
      {/* Header */}
      <View style={styles.addTradeHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.addTradeTitle}>Calendar View</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SIZES.padding }} showsVerticalScrollIndicator={false}>
        <Calendar
          onDayPress={(day: any) => setSelected(day.dateString)}
          markedDates={markedDates}
          theme={{
            todayTextColor: COLORS.primary,
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: COLORS.white,
            dotColor: COLORS.primary,
            arrowColor: COLORS.primary,
            monthTextColor: COLORS.text,
            textDayFontFamily: 'Inter_400Regular',
            textMonthFontFamily: 'Inter_700Bold',
            textDayHeaderFontFamily: 'Inter_600SemiBold',
          }}
        />

        <View style={styles.calendarTradesHeader}>
          <Text style={styles.calendarTradesTitle}>
            {selected ? `Trades for ${selected}` : 'Select a date'}
          </Text>
          {selected && (
            <TouchableOpacity 
              style={styles.calendarAddButton}
              onPress={() => onAddForDate(selected)}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
              <Text style={styles.calendarAddButtonText}>Add Trade</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedDateTrades.length === 0 && selected && (
          <Text style={styles.noTradesText}>No trades found for this date.</Text>
        )}

        {selectedDateTrades.map(trade => (
          <View key={trade.id} style={styles.dailyCard}>
            <View style={styles.tradeCardHeader}>
              <Text style={styles.tradePairText}>{trade.pair}</Text>
              <Text style={[styles.dailyBalance, { color: trade.type === 'Profit' ? COLORS.success : COLORS.error }]}>
                {trade.type === 'Profit' ? '+' : '-'} $ {trade.amount.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function StatisticsScreen({ trades }: { trades: Trade[] }) {
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.type === 'Profit').length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  
  const totalProfit = trades.filter(t => t.type === 'Profit').reduce((a, t) => a + t.amount, 0);
  const totalLoss = trades.filter(t => t.type === 'Loss').reduce((a, t) => a + t.amount, 0);
  const netProfit = totalProfit - totalLoss;
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : totalProfit > 0 ? '∞' : '0.00';

  const avgWin = wins > 0 ? totalProfit / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Stats Card */}
        <View style={st.mainStatsCard}>
          <View style={st.statRow}>
            <View style={st.statItem}>
              <Text style={st.statLabel}>Net Profit</Text>
              <Text style={[st.statValue, { color: netProfit >= 0 ? COLORS.success : COLORS.error }]}>
                ${netProfit.toFixed(2)}
              </Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <Text style={st.statLabel}>Win Rate</Text>
              <Text style={[st.statValue, { color: COLORS.primary }]}>{winRate.toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* Secondary Metrics */}
        <View style={st.metricsGrid}>
          <View style={st.metricItemSmall}>
            <Text style={st.metricLabelSmall}>Profit Factor</Text>
            <Text style={st.metricValueSmall}>{profitFactor}</Text>
          </View>
          <View style={st.metricItemSmall}>
            <Text style={st.metricLabelSmall}>Total Trades</Text>
            <Text style={st.metricValueSmall}>{totalTrades}</Text>
          </View>
        </View>

        {/* Win/Loss Visualization */}
        <Text style={pf.sectionTitle}>Performance Breakdown</Text>
        <View style={st.breakdownCard}>
          <View style={st.breakdownHeader}>
            <View style={st.breakdownInfo}>
              <Text style={st.breakdownLabel}>Wins</Text>
              <Text style={[st.breakdownValue, { color: COLORS.success }]}>{wins}</Text>
            </View>
            <View style={[st.breakdownInfo, { alignItems: 'flex-end' }]}>
              <Text style={st.breakdownLabel}>Losses</Text>
              <Text style={[st.breakdownValue, { color: COLORS.error }]}>{losses}</Text>
            </View>
          </View>
          
          <View style={st.barContainer}>
            <View style={[st.barFill, { flex: wins, backgroundColor: COLORS.success }]} />
            <View style={[st.barFill, { flex: losses, backgroundColor: COLORS.error }]} />
          </View>
          
          <View style={st.avgRow}>
            <View>
              <Text style={st.avgLabel}>Avg Win</Text>
              <Text style={st.avgValue}>${avgWin.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.avgLabel}>Avg Loss</Text>
              <Text style={st.avgValue}>${avgLoss.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Coming Soon: Detailed Charts */}
        <View style={st.comingSoonCard}>
          <Ionicons name="stats-chart" size={32} color={COLORS.primary} />
          <Text style={st.comingSoonTitle}>Equity Curve Coming Soon</Text>
          <Text style={st.comingSoonSub}>We are working on interactive charts for your account growth.</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  mainStatsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricItemSmall: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  metricLabelSmall: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  metricValueSmall: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  breakdownCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownInfo: {
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
  },
  breakdownValue: {
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
  },
  barContainer: {
    height: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 20,
  },
  barFill: {
    height: '100%',
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  avgValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
  },
  comingSoonCard: {
    backgroundColor: '#F8FAFF',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E9FF',
    borderStyle: 'dashed',
  },
  comingSoonTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: COLORS.primary,
    marginTop: 12,
  },
  comingSoonSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});


function AddTargetModal({ 
  visible, 
  onClose, 
  type,
  setTargets
}: { 
  visible: boolean, 
  onClose: () => void, 
  type: string,
  setTargets: React.Dispatch<React.SetStateAction<Targets>>
}) {
  const [targetAmount, setTargetAmount] = useState('');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.bottomSheet}>
          <Text style={styles.modalTitle}>Set {type} Target</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Target Amount ($) *</Text>
            <TextInput 
              style={styles.inputField} 
              placeholder="0.00" 
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
              autoFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: COLORS.primary }]} 
            onPress={() => {
              if (targetAmount) {
                setTargets(prev => ({ ...prev, [type]: parseFloat(targetAmount) }));
                Alert.alert('Success', `${type} target set to $${targetAmount}`);
                onClose();
                setTargetAmount('');
              } else {
                Alert.alert('Error', 'Please enter a target amount.');
              }
            }}
          >
            <Text style={styles.saveButtonText}>Save Target</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function PropFirmSetupModal({ visible, onClose, onSave }: { 
  visible: boolean, onClose: () => void, 
  onSave: (c: PropFirmChallenge) => void 
}) {
  const [challengeType, setChallengeType] = useState<'One Step' | 'Two Step' | 'Zero'>('Two Step');
  const [model, setModel] = useState<'FundingPips' | 'FundingPips Pro'>('FundingPips');
  const [profitTarget, setProfitTarget] = useState<8 | 10>(8);
  const [accountSize, setAccountSize] = useState(100000);

  const sizes = [5000, 10000, 25000, 50000, 100000];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={styles.addTradeHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.addTradeTitle}>Setup Challenge</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: SIZES.padding, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Challenge Type */}
          <Text style={pf.sectionTitle}>Challenge Type</Text>
          <Text style={pf.sectionSub}>Choose the type of challenge</Text>
          <View style={pf.chipRow}>
            {(['One Step', 'Two Step', 'Zero'] as const).map(t => (
              <TouchableOpacity key={t} style={[pf.chip, challengeType === t && pf.chipActive]} onPress={() => setChallengeType(t)}>
                <View style={[pf.radio, challengeType === t && pf.radioActive]} />
                <Text style={[pf.chipText, challengeType === t && pf.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Model */}
          <Text style={pf.sectionTitle}>Model</Text>
          <Text style={pf.sectionSub}>Choose the trading model</Text>
          <View style={pf.chipRow}>
            {([{ k: 'FundingPips' as const, sub: 'Highest drawdown' }, { k: 'FundingPips Pro' as const, sub: 'Weekly/daily payouts' }]).map(m => (
              <TouchableOpacity key={m.k} style={[pf.chip, { flex: 1 }, model === m.k && pf.chipActive]} onPress={() => setModel(m.k)}>
                <View style={[pf.radio, model === m.k && pf.radioActive]} />
                <View>
                  <Text style={[pf.chipText, model === m.k && pf.chipTextActive]}>{m.k}</Text>
                  <Text style={pf.chipSub}>{m.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Profit Target */}
          <Text style={pf.sectionTitle}>Profit Target</Text>
          <Text style={pf.sectionSub}>Choose your profit target</Text>
          <View style={pf.chipRow}>
            <TouchableOpacity style={[pf.chip, { flex: 1 }, profitTarget === 8 && pf.chipActive]} onPress={() => setProfitTarget(8)}>
              <View style={[pf.radio, profitTarget === 8 && pf.radioActive]} />
              <Text style={[pf.chipText, profitTarget === 8 && pf.chipTextActive]}>8%</Text>
              <Text style={pf.chipTag}>Default</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[pf.chip, { flex: 1 }, profitTarget === 10 && pf.chipActive]} onPress={() => setProfitTarget(10)}>
              <View style={[pf.radio, profitTarget === 10 && pf.radioActive]} />
              <Text style={[pf.chipText, profitTarget === 10 && pf.chipTextActive]}>10%</Text>
            </TouchableOpacity>
          </View>

          {/* Account Size */}
          <Text style={pf.sectionTitle}>Account Size</Text>
          <Text style={pf.sectionSub}>Choose your preferred account size</Text>
          <View style={pf.sizeGrid}>
            {sizes.map(s => (
              <TouchableOpacity key={s} style={[pf.sizeChip, accountSize === s && pf.chipActive]} onPress={() => setAccountSize(s)}>
                <View style={[pf.radio, accountSize === s && pf.radioActive]} />
                <Text style={[pf.chipText, accountSize === s && pf.chipTextActive]}>${s.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rules Summary */}
          <View style={pf.rulesCard}>
            <Text style={pf.rulesTitle}>Challenge Rules</Text>
            <View style={pf.ruleRow}><Text style={pf.ruleLabel}>Profit Target</Text><Text style={pf.ruleValue}>{profitTarget}% (${(accountSize * profitTarget / 100).toLocaleString()})</Text></View>
            <View style={pf.ruleRow}><Text style={pf.ruleLabel}>Max Daily Loss</Text><Text style={pf.ruleValue}>5% (${(accountSize * 0.05).toLocaleString()})</Text></View>
            <View style={pf.ruleRow}><Text style={pf.ruleLabel}>Max Drawdown</Text><Text style={pf.ruleValue}>8% (${(accountSize * 0.08).toLocaleString()})</Text></View>
            <View style={pf.ruleRow}><Text style={pf.ruleLabel}>Min Trading Days</Text><Text style={pf.ruleValue}>3 days</Text></View>
            <View style={pf.ruleRow}><Text style={pf.ruleLabel}>Phase</Text><Text style={pf.ruleValue}>{challengeType === 'One Step' ? '1 Phase' : challengeType === 'Two Step' ? '2 Phases' : 'Instant'}</Text></View>
          </View>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.primary }]} onPress={() => {
            onSave({
              accountSize, profitTargetPct: profitTarget, maxDailyLossPct: 5, maxDrawdownPct: 8,
              minTradingDays: 3, phase: '1', startDate: new Date().toISOString().split('T')[0],
            });
            onClose();
          }}>
            <Text style={styles.saveButtonText}>Start Challenge</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PropFirmDashboard({ challenge, trades, onReset }: { challenge: PropFirmChallenge, trades: Trade[], onReset: () => void }) {
  const totalPnL = trades.reduce((a, t) => t.type === 'Profit' ? a + t.amount : a - t.amount, 0);
  const todayDate = new Date().toISOString().split('T')[0];
  const todayLoss = trades.filter(t => t.date === todayDate && t.type === 'Loss').reduce((a, t) => a + t.amount, 0);
  const tradingDays = new Set(trades.map(t => t.date)).size;
  const profitTarget = challenge.accountSize * challenge.profitTargetPct / 100;
  const maxDailyLoss = challenge.accountSize * challenge.maxDailyLossPct / 100;
  const maxDrawdown = challenge.accountSize * challenge.maxDrawdownPct / 100;
  const currentBal = challenge.accountSize + totalPnL;
  const drawdown = Math.max(0, challenge.accountSize - currentBal);
  const profitProg = Math.min(Math.max(totalPnL / profitTarget, 0), 1);
  const dailyLossProg = maxDailyLoss > 0 ? Math.min(todayLoss / maxDailyLoss, 1) : 0;
  const drawdownProg = maxDrawdown > 0 ? Math.min(drawdown / maxDrawdown, 1) : 0;
  const daysProg = Math.min(tradingDays / challenge.minTradingDays, 1);

  const isViolated = todayLoss >= maxDailyLoss || drawdown >= maxDrawdown;
  const isAtRisk = dailyLossProg >= 0.7 || drawdownProg >= 0.7;
  const statusColor = isViolated ? COLORS.error : isAtRisk ? '#FFB800' : COLORS.success;
  const statusText = isViolated ? 'Violated ❌' : isAtRisk ? 'At Risk ⚠️' : 'On Track ✅';

  return (
    <ScrollView contentContainerStyle={{ padding: SIZES.padding, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* Status Banner */}
      <View style={[pf.statusBanner, { borderLeftColor: statusColor }]}>  
        <View style={{ flex: 1 }}>
          <Text style={pf.statusLabel}>Phase {challenge.phase} • {challenge.startDate}</Text>
          <Text style={pf.statusAccount}>${challenge.accountSize.toLocaleString()} Account</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[pf.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[pf.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <TouchableOpacity onPress={onReset}>
            <Text style={{ fontSize: 12, color: COLORS.error, fontFamily: 'Inter_600SemiBold' }}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Balance */}
      <View style={pf.balCard}>
        <Text style={pf.balLabel}>Current Balance</Text>
        <Text style={[pf.balValue, { color: totalPnL >= 0 ? COLORS.primary : COLORS.error }]}>${currentBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        <Text style={[pf.balPnl, { color: totalPnL >= 0 ? COLORS.success : COLORS.error }]}>
          {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} P&L
        </Text>
      </View>

      {/* Profit Target */}
      <View style={pf.metricCard}>
        <View style={pf.metricHeader}>
          <View style={pf.metricIconWrap}><Ionicons name="trending-up" size={18} color={COLORS.primary} /></View>
          <Text style={pf.metricTitle}>Profit Target</Text>
          <Text style={pf.metricPct}>{Math.round(profitProg * 100)}%</Text>
        </View>
        <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${profitProg * 100}%`, backgroundColor: COLORS.primary }]} /></View>
        <View style={pf.metricFooter}>
          <Text style={pf.metricFooterText}>${Math.max(0, totalPnL).toFixed(2)} earned</Text>
          <Text style={pf.metricFooterText}>${profitTarget.toLocaleString()} needed</Text>
        </View>
      </View>

      {/* Daily Loss */}
      <View style={pf.metricCard}>
        <View style={pf.metricHeader}>
          <View style={[pf.metricIconWrap, { backgroundColor: dailyLossProg >= 0.7 ? COLORS.errorBg : '#FFF9E6' }]}>
            <Ionicons name="shield-outline" size={18} color={dailyLossProg >= 0.7 ? COLORS.error : '#FFB800'} />
          </View>
          <Text style={pf.metricTitle}>Daily Loss Limit</Text>
          <Text style={[pf.metricPct, { color: dailyLossProg >= 0.7 ? COLORS.error : COLORS.textMuted }]}>{Math.round(dailyLossProg * 100)}%</Text>
        </View>
        <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${dailyLossProg * 100}%`, backgroundColor: dailyLossProg >= 0.7 ? COLORS.error : '#FFB800' }]} /></View>
        <View style={pf.metricFooter}>
          <Text style={pf.metricFooterText}>${todayLoss.toFixed(2)} today</Text>
          <Text style={pf.metricFooterText}>${maxDailyLoss.toLocaleString()} max</Text>
        </View>
      </View>

      {/* Max Drawdown */}
      <View style={pf.metricCard}>
        <View style={pf.metricHeader}>
          <View style={[pf.metricIconWrap, { backgroundColor: drawdownProg >= 0.7 ? COLORS.errorBg : '#FFF9E6' }]}>
            <Ionicons name="arrow-down-circle-outline" size={18} color={drawdownProg >= 0.7 ? COLORS.error : '#FFB800'} />
          </View>
          <Text style={pf.metricTitle}>Max Drawdown</Text>
          <Text style={[pf.metricPct, { color: drawdownProg >= 0.7 ? COLORS.error : COLORS.textMuted }]}>{Math.round(drawdownProg * 100)}%</Text>
        </View>
        <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${drawdownProg * 100}%`, backgroundColor: drawdownProg >= 0.7 ? COLORS.error : '#FFB800' }]} /></View>
        <View style={pf.metricFooter}>
          <Text style={pf.metricFooterText}>${drawdown.toFixed(2)} drawdown</Text>
          <Text style={pf.metricFooterText}>${maxDrawdown.toLocaleString()} max</Text>
        </View>
      </View>

      {/* Trading Days */}
      <View style={pf.metricCard}>
        <View style={pf.metricHeader}>
          <View style={[pf.metricIconWrap, { backgroundColor: COLORS.successBg }]}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.success} />
          </View>
          <Text style={pf.metricTitle}>Trading Days</Text>
          <Text style={[pf.metricPct, { color: daysProg >= 1 ? COLORS.success : COLORS.textMuted }]}>{tradingDays}/{challenge.minTradingDays}</Text>
        </View>
        <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${daysProg * 100}%`, backgroundColor: COLORS.success }]} /></View>
        <View style={pf.metricFooter}>
          <Text style={pf.metricFooterText}>{tradingDays} completed</Text>
          <Text style={pf.metricFooterText}>{Math.max(0, challenge.minTradingDays - tradingDays)} remaining</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function TargetScreen({ targets, setTargets, trades, propFirm, setPropFirm, onResetPropFirm }: { 
  targets: Targets, setTargets: React.Dispatch<React.SetStateAction<Targets>>,
  trades: Trade[], propFirm: PropFirmChallenge | null,
  setPropFirm: React.Dispatch<React.SetStateAction<PropFirmChallenge | null>>,
  onResetPropFirm: () => void
}) {
  const [activeTab, setActiveTab] = useState<'Daily' | 'Monthly' | 'Custom'>('Daily');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPropFirmSetup, setShowPropFirmSetup] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Targets</Text>
        <View style={styles.dateSelector}>
          <TouchableOpacity style={styles.dateChevron}>
            <Entypo name="chevron-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.dateSelectorText}>
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity style={styles.dateChevron}>
            <Entypo name="chevron-right" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.targetTabsWrapper}>
        <View style={styles.targetTabsContainer}>
          {(['Daily', 'Monthly', 'Custom'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.targetTab, activeTab === tab && styles.targetTabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.targetTabText, activeTab === tab && styles.targetTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content based on tab */}
      {activeTab === 'Custom' ? (
        propFirm ? (
          <PropFirmDashboard challenge={propFirm} trades={trades} onReset={onResetPropFirm} />
        ) : (
          <View style={styles.targetContentArea}>
            <MaterialCommunityIcons name="trophy-outline" size={64} color={COLORS.primary} />
            <Text style={[styles.placeholderTitle, { marginTop: 16 }]}>Prop Firm Challenge</Text>
            <Text style={[styles.placeholderSubtitle, { textAlign: 'center', paddingHorizontal: 40 }]}>
              Track your Funded Pips challenge progress with real-time rule monitoring
            </Text>
            <TouchableOpacity style={[pf.setupBtn]} onPress={() => setShowPropFirmSetup(true)}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
              <Text style={pf.setupBtnText}>Setup Challenge</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <>
          <View style={styles.targetSummaryContainer}>
            <Text style={styles.targetSummaryLabel}>{activeTab} Target</Text>
            <Text style={styles.targetSummaryValue}>
              {targets[activeTab] > 0 ? `$ ${targets[activeTab].toFixed(2)}` : 'Not set'}
            </Text>
          </View>
          <View style={styles.targetContentArea}>
            {targets[activeTab] === 0 ? (
              <Text style={styles.noDataAvailableText}>No data available !</Text>
            ) : (
              <View style={styles.targetStatusCard}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.targetStatusText}>Your {activeTab.toLowerCase()} target is active.</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, styles.fabPlus, styles.targetFab]}
        activeOpacity={0.8}
        onPress={() => activeTab === 'Custom' && propFirm ? onResetPropFirm() : activeTab === 'Custom' ? setShowPropFirmSetup(true) : setShowAddModal(true)}
      >
        <Ionicons name={activeTab === 'Custom' && propFirm ? 'settings-outline' : 'add'} size={activeTab === 'Custom' && propFirm ? 24 : 32} color={COLORS.white} />
      </TouchableOpacity>

      <AddTargetModal visible={showAddModal} onClose={() => setShowAddModal(false)} type={activeTab} setTargets={setTargets} />
      <PropFirmSetupModal visible={showPropFirmSetup} onClose={() => setShowPropFirmSetup(false)} onSave={(c) => setPropFirm(c)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: COLORS.text,
    marginTop: 4,
  },
  headerMenuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SPACING.md,
  },
  monthCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  menuButton: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthBalance: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  calendarButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  calendarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIconBg: {
    marginRight: SPACING.md,
  },
  calendarText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  dailyCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dailyDate: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  dailyBalance: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
  },
  tradeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradePairText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  badge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  successBadge: {
    backgroundColor: COLORS.successBg,
  },
  errorBadge: {
    backgroundColor: COLORS.errorBg,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: SIZES.padding,
    gap: SPACING.md,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  fabPlus: {
    backgroundColor: COLORS.primary,
  },
  fabFlash: {
    backgroundColor: COLORS.secondary,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    justifyContent: 'space-around',
    paddingBottom: SPACING.md,
  },
  tabItem: {
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  placeholderTitle: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  placeholderSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
    marginTop: 4,
  },
  addTradeContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  addTradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    marginRight: SPACING.md,
  },
  addTradeTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  addTradeContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  typeToggle: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeToggleActiveProfit: {
    backgroundColor: COLORS.success,
  },
  typeToggleActiveLoss: {
    backgroundColor: '#A0A0A0',
  },
  typeToggleText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
  },
  typeToggleTextActive: {
    color: COLORS.white,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
    marginBottom: 6,
    position: 'absolute',
    top: -10,
    left: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: COLORS.text,
  },
  inputText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: COLORS.text,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calcButton: {
    marginLeft: SPACING.sm,
    backgroundColor: '#F0F4FE',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  addImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F0F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  saveButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalItemText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  calendarTradesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  calendarTradesTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  calendarAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  calendarAddButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.white,
  },
  noTradesText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateSelectorText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  dateChevron: {
    padding: 4,
  },
  targetTabsWrapper: {
    paddingHorizontal: SIZES.padding,
    marginTop: SPACING.md,
  },
  targetTabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  targetTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  targetTabActive: {
    backgroundColor: COLORS.primary,
  },
  targetTabText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#A0A0A0',
  },
  targetTabTextActive: {
    color: COLORS.white,
  },
  targetContentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataAvailableText: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: '#A0A0A0',
  },
  targetFab: {
    position: 'absolute',
    bottom: 20,
    right: SIZES.padding,
  },
  progressBg: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  targetInfoText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
  },
  progressPercentage: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  tradeDateSmall: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
  },
  tradeCardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  tradeAmountSmall: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  targetSummaryContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  targetSummaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  targetSummaryValue: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: COLORS.primary,
  },
  targetStatusCard: {
    alignItems: 'center',
    gap: 12,
  },
  targetStatusText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: COLORS.text,
  },
});

const pf = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.text,
    marginLeft: 6,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  chipTag: {
    marginLeft: 6,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.success,
  },
  chipSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  radioActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  rulesCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rulesTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ruleLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
  },
  ruleValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
  },
  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderLeftWidth: 4,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
  },
  statusAccount: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  balCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  balLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
  },
  balValue: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 4,
  },
  balPnl: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
  metricCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E6F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.text,
  },
  metricPct: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.textMuted,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metricFooterText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: COLORS.textMuted,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  setupBtnText: {
    color: COLORS.white,
    fontSize: 14,
    marginLeft: 6,
    fontFamily: 'Inter_600SemiBold',
  },
});

function SettingsScreen({ userEmail, onLogout }: { userEmail: string, onLogout: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={st.mainStatsCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center' }}>
              <FontAwesome name="user" size={32} color={COLORS.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: COLORS.text }}>Trader</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: COLORS.textMuted }}>{userEmail}</Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <Text style={pf.sectionTitle}>Preferences</Text>
        <View style={st.breakdownCard}>
          <TouchableOpacity style={se.settingRow}>
            <View style={se.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
              <Text style={se.settingLabel}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={se.settingDivider} />
          <TouchableOpacity style={se.settingRow}>
            <View style={se.settingLeft}>
              <Ionicons name="moon-outline" size={22} color={COLORS.text} />
              <Text style={se.settingLabel}>Dark Mode</Text>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.textMuted }}>System</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <Text style={pf.sectionTitle}>Account</Text>
        <View style={st.breakdownCard}>
          <TouchableOpacity style={se.settingRow}>
            <View style={se.settingLeft}>
              <Ionicons name="help-circle-outline" size={22} color={COLORS.text} />
              <Text style={se.settingLabel}>Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={se.settingDivider} />
          <TouchableOpacity style={se.settingRow} onPress={onLogout}>
            <View style={se.settingLeft}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
              <Text style={[se.settingLabel, { color: COLORS.error }]}>Log Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 40 }}>Trading Journal v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'tradingjournal://google-auth',
          skipBrowserRedirect: true, // This allows us to handle the redirect manually in React Native
        },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        // Open the Google login page in the device's browser
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert('Error', 'Could not open the browser. Please try again.');
        }
      }
    } catch (e: any) {
      Alert.alert('Google Auth Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Success', 'Account created! You can now log in.');
        setIsLogin(true); // Switch to login view after signup
      }
    } catch (e: any) {
      Alert.alert('Auth Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="journal" size={40} color={COLORS.white} />
          </View>
          <Text style={{ fontSize: 28, fontFamily: 'Inter_800ExtraBold', color: COLORS.text }}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_400Regular', color: COLORS.textMuted, marginTop: 8 }}>Track your journey to consistency</Text>
        </View>

        <View style={{ gap: 16 }}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput 
              style={styles.inputField} 
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput 
              style={styles.inputField} 
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: COLORS.primary, marginTop: 10 }]} 
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>{loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#EEE' }} />
            <Text style={{ paddingHorizontal: 10, color: COLORS.textMuted, fontSize: 12, fontFamily: 'Inter_500Medium' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#EEE' }} />
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#EEE', marginTop: 0 }]} 
            onPress={signInWithGoogle}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="logo-google" size={20} color="#EA4335" />
              <Text style={[styles.saveButtonText, { color: COLORS.text, fontSize: 16 }]}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: COLORS.textMuted }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const se = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: COLORS.text,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
  },
});
