package com.yisi.gomokucoach;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public final class MainActivity extends Activity {
    private static final int GREEN = Color.rgb(36, 95, 67), RED = Color.rgb(167, 55, 47), PAPER = Color.rgb(244, 240, 231);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService engine = Executors.newSingleThreadExecutor();
    private final AtomicInteger generation = new AtomicInteger();
    private final List<Stone> stones = new ArrayList<>(), history = new ArrayList<>();
    private final List<EngineLine> lines = new ArrayList<>();
    private final Map<Integer, Double> scores = new HashMap<>();
    private GomokuBoardView board;
    private SituationChartView chart;
    private TextView engineState, summary;
    private LinearLayout candidates, modeButtons, ruleButtons, depthButtons;
    private Button bestButton, sideButton, turnButton, undoButton, redoButton;
    private String mode = "local", rule = "freestyle";
    private int turn = 1, human = 1, setupPlayer = 1, depth = 10;
    private boolean flipped, showBest;
    private File configFile;
    private long lastCandidateTap;
    private EngineLine lastTappedLine;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(251,250,247));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        configFile = prepareEngineAssets();
        setContentView(buildContent());
        refreshBoard();
        analyzeCurrent();
    }

    private View buildContent() {
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(PAPER);
        LinearLayout root = column(); root.setPadding(dp(14), dp(10), dp(14), dp(28)); scroll.addView(root);

        LinearLayout header = row(); header.setGravity(Gravity.CENTER_VERTICAL); header.setPadding(0, dp(5), 0, dp(10));
        TextView logo = text("五", 24, Color.WHITE); logo.setGravity(Gravity.CENTER); logo.setBackgroundColor(GREEN); header.addView(logo, new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout titles=column(); titles.setPadding(dp(12),0,0,0); TextView brand=text("弈思",20,Color.rgb(31,38,33));brand.setTypeface(null,1);titles.addView(brand);titles.addView(text("五子棋思考教练 · Android",12,Color.GRAY));header.addView(titles,weighted());
        engineState = text("Rapfi 启动中", 11, Color.rgb(122,117,108)); header.addView(engineState); root.addView(header);

        LinearLayout toolbar = row(); toolbar.setGravity(Gravity.CENTER_VERTICAL);
        undoButton=smallButton("↶", v -> undo()); undoButton.setContentDescription("悔棋"); toolbar.addView(undoButton);
        redoButton=smallButton("↷", v -> redo()); redoButton.setContentDescription("前进"); toolbar.addView(redoButton);
        bestButton = circleButton("优"); bestButton.setOnClickListener(v -> { showBest=!showBest; board.setShowBest(showBest); styleBest(); }); toolbar.addView(bestButton);
        turnButton = button("黑方走棋"); turnButton.setBackgroundColor(Color.TRANSPARENT); turnButton.setEnabled(false); toolbar.addView(turnButton, weighted());
        Button flip=smallButton("⇅", v -> { flipped=!flipped; board.setFlipped(flipped); }); flip.setContentDescription("翻转棋盘"); toolbar.addView(flip);
        Button restart=smallButton("↻", v -> reset()); restart.setContentDescription("重开"); toolbar.addView(restart); root.addView(toolbar);

        board = new GomokuBoardView(this); board.setListener(this::tapBoard); root.addView(board, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(410)));

        LinearLayout settings = card(); settings.setOrientation(LinearLayout.VERTICAL);
        settings.addView(settingTitle("局", "对弈方式", "选择练习方式"));
        modeButtons = segmented();
        addChoice(modeButtons, "双人对弈", "local", () -> setMode("local"));
        addChoice(modeButtons, "人机对战", "computer", () -> setMode("computer"));
        addChoice(modeButtons, "摆盘", "setup", () -> setMode("setup"));
        settings.addView(modeButtons);
        sideButton = button("我执黑"); sideButton.setOnClickListener(v -> { if ("computer".equals(mode)) { human=human==1?2:1; sideButton.setText("我执"+(human==1?"黑":"白")); maybeComputerMove(); } else { setupPlayer=setupPlayer==1?2:1; sideButton.setText("摆放"+(setupPlayer==1?"黑":"白")); } }); settings.addView(sideButton); sideButton.setVisibility(View.GONE);
        settings.addView(settingTitle("规", "行棋规则", "切换后重新分析"));
        ruleButtons = segmented();
        addChoice(ruleButtons, "自由五子棋", "freestyle", () -> setRule("freestyle"));
        addChoice(ruleButtons, "标准五子棋", "standard", () -> setRule("standard"));
        addChoice(ruleButtons, "连珠", "renju", () -> setRule("renju"));
        settings.addView(ruleButtons);

        LinearLayout analysisCard = card();
        TextView analysisTitle = text("教练分析", 16, Color.rgb(31,38,33)); analysisTitle.setTypeface(null,1); analysisCard.addView(analysisTitle);
        summary = text("等待 Rapfi 返回可靠评分", 13, Color.rgb(80,86,81)); summary.setPadding(0,dp(8),0,dp(8)); analysisCard.addView(summary);
        candidates = column(); analysisCard.addView(candidates); root.addView(collapsible("教练分析", analysisCard, true), marginTop(12));

        LinearLayout depthCard = card(); depthCard.addView(settingTitle("深", "分析深度", "手机默认 10，可随时切换"));
        depthButtons = segmented();
        for (int value : new int[]{8,10,12,14,16}) addChoice(depthButtons, String.valueOf(value), String.valueOf(value), () -> { depth=value; styleChoices(depthButtons,String.valueOf(value)); analyzeCurrent(); });
        depthCard.addView(depthButtons);

        LinearLayout trendCard = column();
        TextView trendTitle = text("局势图 · 黑方视角", 16, Color.rgb(31,38,33)); trendTitle.setTypeface(null,1); trendTitle.setPadding(dp(4),dp(18),0,dp(6)); trendCard.addView(trendTitle);
        chart = new SituationChartView(this); trendCard.addView(chart, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(210)));
        root.addView(collapsible("局势图", trendCard, false), marginTop(12));
        settings.addView(depthCard);
        root.addView(collapsible("对弈与分析设置", settings, false), marginTop(12));
        styleChoices(modeButtons, mode); styleChoices(ruleButtons, rule); styleChoices(depthButtons, String.valueOf(depth));
        return scroll;
    }

    private void tapBoard(int x, int y) {
        if ("setup".equals(mode)) {
            stones.removeIf(s -> s.x==x && s.y==y); stones.add(new Stone(x,y,setupPlayer));
            history.clear(); history.addAll(stones); scores.clear(); refreshBoard(); return;
        }
        if (winner(stones)!=0 || stones.size()>=225 || occupied(x,y) || ("computer".equals(mode) && turn!=human)) return;
        place(x,y);
    }

    private void place(int x, int y) {
        generation.incrementAndGet(); RapfiNative.stop();
        while (history.size()>stones.size()) history.remove(history.size()-1);
        Stone move=new Stone(x,y,turn); stones.add(move); history.add(move);
        scores.keySet().removeIf(ply -> ply>stones.size()-1);
        turn=turn==1?2:1; lines.clear(); refreshBoard();
        if (winner(stones)!=0 || stones.size()>=225) { showGameOutcome(); return; }
        analyzeCurrent();
    }

    private void setMode(String value) {
        mode=value; lines.clear(); board.setCandidates(lines); styleChoices(modeButtons,value);
        sideButton.setVisibility("local".equals(value)?View.GONE:View.VISIBLE);
        sideButton.setText("setup".equals(value)?"摆放"+(setupPlayer==1?"黑":"白"):"我执"+(human==1?"黑":"白"));
        if ("setup".equals(value)) { generation.incrementAndGet(); RapfiNative.stop(); engineState.setText("摆盘模式"); }
        else analyzeCurrent();
    }

    private void setRule(String value) { rule=value; styleChoices(ruleButtons,value); if (!"setup".equals(mode)) analyzeCurrent(); }
    private void undo() { if (stones.isEmpty()) return; generation.incrementAndGet(); RapfiNative.stop(); stones.remove(stones.size()-1); turn=turn==1?2:1; refreshBoard(); analyzeCurrent(); }
    private void redo() { if (stones.size()>=history.size()) return; generation.incrementAndGet(); RapfiNative.stop(); stones.add(history.get(stones.size())); turn=turn==1?2:1; refreshBoard(); analyzeCurrent(); }
    private void reset() { generation.incrementAndGet(); RapfiNative.stop(); stones.clear(); history.clear(); scores.clear(); lines.clear(); turn=1; refreshBoard(); if (!"setup".equals(mode)) analyzeCurrent(); }

    private void analyzeCurrent() {
        if ("setup".equals(mode) || winner(stones)!=0 || stones.size()>=225) { refreshBoard(); return; }
        int id=generation.incrementAndGet(), side=turn, ply=stones.size(), selectedDepth=depth;
        RapfiNative.stop();
        List<Stone> snapshot=new ArrayList<>(stones);
        if (snapshot.isEmpty()) {
            EngineLine opening = new EngineLine();
            opening.rank = 1;
            opening.pv.add(new int[]{7, 7});
            lines.clear(); lines.add(opening);
            engineState.setText("Rapfi 开局首选已就绪");
            summary.setText("全局首选 H8 · 空棋盘中心点");
            refreshBoard(); rebuildCandidates(); maybeComputerMove();
            return;
        }
        engineState.setText("Rapfi 深度 "+selectedDepth+" 计算中…（仍可落子）"); summary.setText("当前局面正在计算，未完成前不显示猜测分数。");
        engine.execute(() -> {
            if (generation.get()!=id) return;
            String raw=RapfiNative.analyze(configFile.getAbsolutePath(), commands(snapshot,side,selectedDepth,5), budget(selectedDepth)+4500);
            List<EngineLine> result=RapfiOutput.parse(raw);
            main.post(() -> {
                if (generation.get()!=id) return;
                lines.clear(); lines.addAll(result);
                if (!result.isEmpty()) {
                    EngineLine first=result.get(0);
                    if (first.eval!=null) scores.put(ply, side==1?first.eval.doubleValue():-first.eval.doubleValue());
                    engineState.setText("Rapfi 已就绪 · 深度 "+first.depth);
                    summary.setText("全局首选 "+pointName(first.pv.get(0))+" · 行棋方评分 "+first.scoreText());
                } else { engineState.setText("Rapfi 未返回可靠结果"); summary.setText(raw.startsWith("ERROR:")?raw.substring(6):"本次计算没有完整评分。"); }
                refreshBoard(); rebuildCandidates(); maybeComputerMove(); backfillScores(id);
            });
        });
    }

    private void backfillScores(int parentGeneration) {
        int missing=-1; for (int ply=0;ply<=history.size();ply++) if (ply!=stones.size()&&!scores.containsKey(ply)) { missing=ply; break; }
        if (missing<0) return;
        final int target=missing, side=target%2==0?1:2; List<Stone> snapshot=new ArrayList<>(history.subList(0,target));
        if (snapshot.isEmpty()) return;
        engine.execute(() -> {
            if (generation.get() != parentGeneration) return;
            List<EngineLine> result=RapfiOutput.parse(RapfiNative.analyze(configFile.getAbsolutePath(),commands(snapshot,side,Math.min(10,depth),1),budget(Math.min(10,depth))+4500));
            main.post(() -> {
                if (generation.get() != parentGeneration) return;
                if (result.isEmpty() || result.get(0).eval == null) return;
                scores.put(target, side == 1 ? result.get(0).eval.doubleValue() : -result.get(0).eval.doubleValue());
                refreshChart();
                backfillScores(parentGeneration);
            });
        });
    }

    private void maybeComputerMove() {
        if (!"computer".equals(mode)||turn==human||lines.isEmpty()||lines.get(0).pv.isEmpty()) return;
        int[] point=lines.get(0).pv.get(0); main.postDelayed(() -> { if ("computer".equals(mode)&&turn!=human&&!occupied(point[0],point[1])) place(point[0],point[1]); },500);
    }

    private void rebuildCandidates() {
        candidates.removeAllViews();
        for (int i=0;i<lines.size();i++) {
            EngineLine line=lines.get(i); if (line.pv.isEmpty()) continue;
            Button item=button((i+1)+".  "+pointName(line.pv.get(0))+"    "+line.scoreText()+"\n胜率 "+(line.winRate==null?"—":Math.round(line.winRate*100)+"%"));
            item.setTextColor(turn==1?Color.BLACK:Color.WHITE);
            item.setBackgroundColor(Color.rgb(118,118,118));
            item.setGravity(Gravity.START|Gravity.CENTER_VERTICAL); item.setPadding(dp(12),dp(9),dp(12),dp(9));
            item.setOnClickListener(v -> { long now=System.currentTimeMillis(); if (lastTappedLine==line&&now-lastCandidateTap<360) { int[] p=line.pv.get(0); if (!occupied(p[0],p[1])) place(p[0],p[1]); } else preview(line); lastTappedLine=line; lastCandidateTap=now; });
            candidates.addView(item, marginTop(5));
        }
    }

    private void preview(EngineLine line) {
        final int previewTurn = turn;
        board.setPreview(new ArrayList<>(), previewTurn); final List<int[]> shown=new ArrayList<>();
        final List<int[]> variation = previewVariation(line, previewTurn);
        for (int i=0;i<variation.size();i++) { int index=i; main.postDelayed(() -> { shown.add(variation.get(index)); board.setPreview(shown, previewTurn); }, i*620L); }
        main.postDelayed(() -> board.setPreview(new ArrayList<>(), previewTurn), variation.size()*620L+800);
    }

    private List<int[]> previewVariation(EngineLine line, int firstPlayer) {
        List<int[]> result = new ArrayList<>();
        List<Stone> position = new ArrayList<>(stones);
        for (int i=0; i<Math.min(18,line.pv.size()); i++) {
            int[] point=line.pv.get(i); boolean used=false;
            for (Stone stone:position) if (stone.x==point[0]&&stone.y==point[1]) { used=true; break; }
            if (used) break;
            int player=i%2==0?firstPlayer:(firstPlayer==1?2:1);
            position.add(new Stone(point[0],point[1],player)); result.add(point);
            if (winner(position)!=0) break;
        }
        return result;
    }

    private void refreshBoard() {
        board.setPosition(stones); board.setCandidates(lines); board.setShowBest(showBest); styleBest(); refreshChart();
        int result=winner(stones); turnButton.setText(result==0?(turn==1?"黑方走棋":"白方走棋"):(result==1?"黑方胜":"白方胜"));
        if(undoButton!=null){undoButton.setEnabled(!stones.isEmpty());undoButton.setAlpha(stones.isEmpty()?.35f:1f);}
        if(redoButton!=null){boolean canRedo=stones.size()<history.size();redoButton.setEnabled(canRedo);redoButton.setAlpha(canRedo?1f:.35f);}
        if (result!=0) engineState.setText((result==1?"黑":"白")+"方胜");
    }
    private void refreshChart() { if (chart!=null) chart.update(scores,history.size(),stones.size()); }
    private void showGameOutcome() {
        int result=winner(stones);
        String title=result==0?"和棋":(result==1?"黑方获胜":"白方获胜");
        String detail=result==0?"棋盘已满，双方均未形成五连。":(result==1?"黑方":"白方")+"率先连成五子。";
        new AlertDialog.Builder(this).setTitle(title).setMessage(detail)
                .setPositiveButton("再来一局",(dialog,which)->reset())
                .setNegativeButton("查看棋局",null).show();
    }
    private void styleBest() { if (bestButton!=null) { bestButton.setBackgroundColor(showBest?GREEN:Color.TRANSPARENT); bestButton.setTextColor(showBest?Color.WHITE:Color.rgb(92,91,85)); } }

    private String commands(List<Stone> position,int side,int maxDepth,int multiPV) {
        StringBuilder text=new StringBuilder("START 15\nYXSHOWINFO\nINFO RULE ").append(ruleCode()).append("\nINFO TIMEOUT_TURN ").append(budget(maxDepth)).append("\nINFO MAX_DEPTH ").append(maxDepth).append("\nINFO SHOW_DETAIL 2\nINFO THREAD_NUM 1\nYXBOARD\n");
        for (Stone stone:position) text.append(stone.x).append(',').append(stone.y).append(',').append(stone.player).append('\n');
        return text.append("DONE\nYXNBEST ").append(multiPV).append('\n').toString();
    }
    private int ruleCode() { return "standard".equals(rule)?1:"renju".equals(rule)?2:0; }
    private int budget(int value) { return value<=8?1800:value<=10?3000:value<=12?5500:value<=14?9000:15000; }
    private boolean occupied(int x,int y) { for(Stone s:stones) if(s.x==x&&s.y==y)return true; return false; }
    private static int winner(List<Stone> values) { for(Stone s:values) for(int[] d:new int[][]{{1,0},{0,1},{1,1},{1,-1}}) { int count=1; for(int sign:new int[]{-1,1}) for(int n=1;n<5;n++) { boolean found=false; for(Stone q:values) if(q.player==s.player&&q.x==s.x+d[0]*n*sign&&q.y==s.y+d[1]*n*sign){found=true;break;} if(!found)break; count++; } if(count>=5)return s.player; } return 0; }
    private static String pointName(int[] p) { return String.valueOf((char)('A'+p[0]))+(15-p[1]); }

    private File prepareEngineAssets() {
        File directory=new File(getFilesDir(),"rapfi"); directory.mkdirs();
        for(String name:new String[]{"config.toml","model210901.bin","mix9svqfreestyle_bsmix.bin.lz4","mix9svqstandard_bs15.bin.lz4","mix9svqrenju_bs15_black.bin.lz4","mix9svqrenju_bs15_white.bin.lz4","RAPFI-GPL-3.0.txt"}) {
            File target=new File(directory,name); if(target.exists()&&target.length()>0)continue;
            try(InputStream input=getAssets().open(name); FileOutputStream output=new FileOutputStream(target)){ byte[] buffer=new byte[1024*1024]; int count; while((count=input.read(buffer))>0)output.write(buffer,0,count); } catch(Exception error){ throw new IllegalStateException("无法准备 Rapfi 资源："+name,error); }
        }
        return new File(directory,"config.toml");
    }

    @Override protected void onDestroy() { generation.incrementAndGet(); RapfiNative.stop(); engine.shutdownNow(); super.onDestroy(); }

    private LinearLayout row(){ LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);return v; }
    private View collapsible(String title, View content, boolean expanded){LinearLayout shell=column();TextView heading=text((expanded?"▴ ":"▾ ")+title,14,GREEN);heading.setTypeface(null,1);heading.setGravity(Gravity.CENTER_VERTICAL);heading.setPadding(dp(14),0,dp(14),0);heading.setBackgroundColor(Color.rgb(253,251,246));content.setVisibility(expanded?View.VISIBLE:View.GONE);heading.setOnClickListener(v->{boolean show=content.getVisibility()!=View.VISIBLE;content.setVisibility(show?View.VISIBLE:View.GONE);heading.setText((show?"▴ ":"▾ ")+title);});shell.addView(heading,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(44)));shell.addView(content,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));return shell;}
    private LinearLayout column(){ LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v; }
    private LinearLayout card(){ LinearLayout v=column();v.setPadding(dp(13),dp(12),dp(13),dp(12));v.setBackgroundColor(Color.rgb(253,251,246));return v; }
    private TextView text(String value,int size,int color){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);return v;}
    private Button button(String value){Button v=new Button(this);v.setText(value);v.setTextSize(11);v.setTextColor(Color.rgb(75,73,68));v.setAllCaps(false);v.setBackgroundColor(Color.rgb(250,248,243));return v;}
    private Button smallButton(String value,View.OnClickListener listener){Button v=button(value);v.setBackgroundColor(Color.TRANSPARENT);v.setMinWidth(dp(42));v.setOnClickListener(listener);return v;}
    private Button circleButton(String value){Button v=button(value);v.setBackgroundColor(Color.TRANSPARENT);v.setMinWidth(dp(44));v.setOnClickListener(null);return v;}
    private LinearLayout segmented(){LinearLayout v=row();v.setPadding(dp(3),dp(3),dp(3),dp(3));v.setBackgroundColor(Color.rgb(239,234,225));return v;}
    private View settingTitle(String seal,String title,String note){LinearLayout v=row();v.setGravity(Gravity.CENTER_VERTICAL);TextView s=text(seal,13,Color.rgb(139,109,73));s.setGravity(Gravity.CENTER);v.addView(s,new LinearLayout.LayoutParams(dp(34),dp(34)));LinearLayout copy=column();TextView t=text(title,13,Color.rgb(38,42,39));t.setTypeface(null,1);copy.addView(t);copy.addView(text(note,9,Color.rgb(142,136,126)));v.addView(copy);v.setPadding(0,dp(4),0,dp(7));return v;}
    private void addChoice(LinearLayout parent,String label,String tag,Runnable action){Button v=button(label);v.setTag(tag);v.setOnClickListener(view->action.run());parent.addView(v,weighted());}
    private void styleChoices(LinearLayout group,String active){for(int i=0;i<group.getChildCount();i++){Button b=(Button)group.getChildAt(i);boolean on=active.equals(b.getTag());b.setBackgroundColor(on?GREEN:Color.TRANSPARENT);b.setTextColor(on?Color.WHITE:Color.rgb(94,89,81));}}
    private LinearLayout.LayoutParams weighted(){return new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1);}
    private LinearLayout.LayoutParams marginTop(int value){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);p.topMargin=dp(value);return p;}
    private int dp(float v){return Math.round(v*getResources().getDisplayMetrics().density);}
}
