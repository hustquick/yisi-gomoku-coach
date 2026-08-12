package com.yisi.gomokucoach;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

final class SituationChartView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Map<Integer, Double> scores = new HashMap<>();
    private int plies, active;
    SituationChartView(Context context) { super(context); setMinimumHeight(dp(190)); }
    void update(Map<Integer, Double> value, int historyLength, int activePly) {
        scores.clear(); scores.putAll(value); plies = historyLength; active = activePly; invalidate();
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float l = dp(42), r = getWidth() - dp(18), t = dp(18), b = getHeight() - dp(26), mid = (t+b)/2;
        double largest = 0;
        for (double score : scores.values()) largest = Math.max(largest, Math.abs(score));
        double range = Math.max(300, Math.ceil(largest / 100) * 100);
        paint.setTextSize(dp(10)); paint.setTextAlign(Paint.Align.RIGHT);
        for (double fraction : new double[]{1, 0.5, 0, -0.5, -1}) {
            float y=(float)(mid-fraction*(b-t)/2); paint.setColor(fraction==0?Color.rgb(105,103,97):Color.rgb(220,214,203));
            paint.setStrokeWidth(dp(fraction==0?1.5f:1)); canvas.drawLine(l,y,r,y,paint);
            paint.setColor(Color.rgb(130,125,116)); canvas.drawText(scoreLabel(range*fraction),l-dp(6),y+dp(3),paint);
        }
        Path path = new Path(); boolean started=false;
        for (int ply=0; ply<=plies; ply++) {
            Double score=scores.get(ply);
            if (score==null) { started=false; continue; }
            float x=l+(plies==0?0:(float)ply/plies)*(r-l);
            float y=(float)(mid-Math.max(-range,Math.min(range,score))/range*(b-t)/2);
            if (!started) { path.moveTo(x,y); started=true; } else path.lineTo(x,y);
            paint.setStyle(Paint.Style.FILL); paint.setColor(ply==active?Color.rgb(36,95,67):Color.rgb(167,55,47)); canvas.drawCircle(x,y,ply==active?dp(5):dp(3),paint);
        }
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(3)); paint.setColor(Color.rgb(167,55,47)); canvas.drawPath(path,paint);
        paint.setStyle(Paint.Style.FILL); paint.setTextAlign(Paint.Align.LEFT); paint.setTextSize(dp(10)); paint.setColor(Color.rgb(130,125,116));
        canvas.drawText("黑优", l, dp(12), paint); canvas.drawText("白优", l, getHeight()-dp(8), paint);
    }
    private String scoreLabel(double value) { return value==0?"0":String.format(Locale.CHINA,"%+.1f",value/100); }
    private int dp(float v) { return Math.round(v*getResources().getDisplayMetrics().density); }
}
