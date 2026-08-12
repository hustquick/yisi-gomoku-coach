import SwiftUI

struct ContentView: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var coach = CoachViewModel()
    @State private var chartPly = 0
    @State private var analysisExpanded = true
    @State private var situationExpanded = false
    @State private var settingsExpanded = false
    private var paper: Color {
        colorScheme == .dark
            ? Color(red: 0.075, green: 0.085, blue: 0.078)
            : Color(red: 0.96, green: 0.94, blue: 0.89)
    }
    private var surface: Color {
        colorScheme == .dark ? Color(red: 0.13, green: 0.145, blue: 0.135) : .white.opacity(0.78)
    }
    private var green: Color {
        colorScheme == .dark
            ? Color(red: 0.38, green: 0.76, blue: 0.57)
            : Color(red: 0.12, green: 0.34, blue: 0.24)
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollViewReader { reader in
                Group {
                    if geometry.size.width >= 760 {
                        iPadLayout(reader: reader, size: geometry.size)
                    } else {
                        phoneLayout(reader: reader)
                    }
                }
                .background(paper.ignoresSafeArea())
                .onAppear { chartPly = coach.activePly; coach.analyze() }
                .onChange(of: coach.activePly) { _, value in chartPly = value }
            }
        }
        .alert(coach.gameOutcomeTitle, isPresented: $coach.isShowingGameOutcome) {
            Button("再来一局") { coach.reset() }
            Button("查看棋局", role: .cancel) {}
        } message: {
            Text(coach.gameOutcomeDetail)
        }
    }

    private func phoneLayout(reader: ScrollViewProxy) -> some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                header
                toolbar
                board.padding(.horizontal, 10)
                boardStatus
                analysisCard(reader: reader)
                situationChart(reader: reader)
                settingsCard
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 32)
        }
    }

    private func iPadLayout(reader: ScrollViewProxy, size: CGSize) -> some View {
        VStack(spacing: 12) {
            header.padding(.horizontal, 24)
            HStack(alignment: .top, spacing: 20) {
                VStack(spacing: 12) {
                    toolbar
                    board
                        .frame(maxWidth: min(size.width * 0.59, size.height - 150),
                               maxHeight: min(size.width * 0.59, size.height - 150))
                    boardStatus
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)

                ScrollView {
                    LazyVStack(spacing: 16) {
                        analysisCard(reader: reader)
                        situationChart(reader: reader)
                        settingsCard
                    }
                    .padding(.trailing, 6)
                    .padding(.bottom, 24)
                }
                .frame(width: min(410, size.width * 0.38))
            }
            .padding(.horizontal, 24)
        }
        .padding(.top, 10)
    }

    private var board: some View {
        GomokuBoardView(
            stones: coach.stones,
            turn: coach.turn,
            candidates: coach.lines,
            showBest: coach.showBest,
            flipped: coach.flipped,
            previewLine: coach.previewLine,
            previewCount: coach.previewCount,
            onTap: coach.place
        )
        .id("board")
    }

    private var boardStatus: some View {
        Text(coach.winner == nil ? "\(coach.turn.name)方走棋 · \(coach.engineMessage)" : "对局结束 · \(coach.winner!.name)方胜")
            .font(.caption)
            .foregroundStyle(.secondary)
    }

    private func situationChart(reader: ScrollViewProxy) -> some View {
        SituationChartView(points: coach.scores, historyCount: coach.history.count,
                           activePly: $chartPly, isExpanded: $situationExpanded) { ply in
            coach.go(to: ply)
            withAnimation { reader.scrollTo("board", anchor: .top) }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            brandLogo
            VStack(alignment: .leading, spacing: 1) {
                Text("弈思").font(.title2.bold())
                Text("五子棋思考教练 · iOS").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Circle().fill(coach.turn == .black ? Color.black : .white).overlay(Circle().stroke(.black.opacity(0.35))).frame(width: 13, height: 13)
            Text(coach.winner == nil ? "\(coach.turn.name)方" : "终局").font(.subheadline.bold())
        }
        .padding(.top, 8)
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            toolButton("arrow.uturn.backward", "悔棋", action: coach.undo)
                .disabled(coach.activePly == 0)
            toolButton("arrow.uturn.forward", "前进") { coach.go(to: coach.activePly + 1) }
                .disabled(coach.activePly >= coach.history.count)
            Spacer()
            Button { coach.showBest.toggle() } label: { Text("优").font(.headline).frame(width: 42, height: 36).background(coach.showBest ? green : Color.clear, in: Circle()).foregroundStyle(coach.showBest ? Color.white : green) }.accessibilityLabel("显示全局最优落点")
            Spacer()
            Text(coach.winner == nil ? "\(coach.turn.name)方走棋" : "\(coach.winner!.name)方胜")
                .font(.subheadline.bold())
            Spacer()
            toolButton("arrow.up.arrow.down", "倒置") { coach.flipped.toggle() }
            toolButton("arrow.clockwise", "重开", action: coach.reset)
        }
    }

    private func toolButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: icon).frame(width: 34, height: 34).contentShape(Circle()) }
            .foregroundStyle(green).accessibilityLabel(label)
    }

    @ViewBuilder private var brandLogo: some View {
        let resource = colorScheme == .dark ? "AppIconDark" : "AppIcon"
        if let path = Bundle.main.path(forResource: resource, ofType: "png"),
           let image = UIImage(contentsOfFile: path) {
            Image(uiImage: image)
                .resizable().scaledToFit()
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        } else {
            Text("五").font(.title.bold()).foregroundStyle(.white)
                .frame(width: 48, height: 48).background(green)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func analysisCard(reader: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("教练分析").font(.headline)
                    Text(coach.engineMessage).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(coach.summaryTitle).font(.title3.bold()).foregroundStyle(green)
                collapseButton(isExpanded: $analysisExpanded, label: "教练分析")
            }

            if analysisExpanded, let best = coach.lines.first, let point = best.variation.first {
                HStack {
                    VStack(alignment: .leading) {
                        Text("全局最优着法").font(.caption).foregroundStyle(.secondary)
                        Text(point.name)
                            .font(.title2.bold())
                            .foregroundStyle(candidateMoveColor)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(candidateMoveBackground, in: RoundedRectangle(cornerRadius: 6))
                    }
                    Spacer()
                    Text(best.scoreText).font(.subheadline.bold()).foregroundStyle(green)
                }
                .padding(12).background(green.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            }

            if analysisExpanded {
                Text("Rapfi 候选 · 按行棋方评分从高到低").font(.caption).foregroundStyle(.secondary)
            }
            if analysisExpanded && coach.lines.isEmpty {
                Text(coach.isThinking ? "正在计算候选落点…" : "引擎完成后显示可靠候选，不生成猜测分数。")
                    .font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 18)
            } else if analysisExpanded {
                ForEach(Array(coach.lines.enumerated()), id: \.element.id) { index, line in
                    candidateRow(index: index, line: line)
                        .gesture(
                            TapGesture(count: 2)
                                .onEnded { coach.playCandidate(line) }
                                .exclusively(before: TapGesture(count: 1).onEnded {
                                    coach.selectCandidate(line)
                                    withAnimation { reader.scrollTo("board", anchor: .top) }
                                })
                        )
                }
            }
        }
        .padding(16)
        .background(surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func candidateRow(index: Int, line: EngineLine) -> some View {
        let selected = coach.previewLine?.id == line.id
        return HStack(spacing: 12) {
            Text("\(index + 1)").font(.caption.bold()).foregroundStyle(.secondary).frame(width: 20)
            VStack(alignment: .leading, spacing: 3) {
                Text(line.variation.first?.name ?? "—")
                    .font(.headline)
                    .foregroundStyle(candidateMoveColor)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(candidateMoveBackground, in: RoundedRectangle(cornerRadius: 6))
                Text(line.variation.prefix(5).map(\.name).joined(separator: " → ")).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(index == 0 ? "最佳" : "候选").font(.caption).foregroundStyle(index == 0 ? .green : .secondary)
                Text(line.scoreText).font(.subheadline.bold())
            }
        }
        .padding(12)
        .background(selected ? green.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(selected ? green : Color.secondary.opacity(0.2)))
        .contentShape(Rectangle())
    }

    private var candidateMoveColor: Color { coach.turn == .black ? .black : .white }
    private var candidateMoveBackground: Color { Color(white: 0.46) }

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("对弈与分析设置").font(.headline)
                Spacer()
                collapseButton(isExpanded: $settingsExpanded, label: "对弈与分析设置")
            }
            if settingsExpanded {
                Picker("对弈方式", selection: Binding(get: { coach.mode }, set: coach.setMode)) {
                ForEach(PlayMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)

                if coach.mode == .computer {
                    Picker("执棋方", selection: $coach.human) {
                        Text("我执黑").tag(StoneSide.black); Text("我执白").tag(StoneSide.white)
                    }.pickerStyle(.segmented)
                } else if coach.mode == .setup {
                    HStack {
                        Button("摆黑") { coach.setupBrush = .black }
                        Button("摆白") { coach.setupBrush = .white }
                        Button("橡皮") { coach.setupBrush = nil }
                        Spacer(); Button("完成摆盘", action: coach.finishSetup).buttonStyle(.borderedProminent).tint(green)
                    }.buttonStyle(.bordered)
                }

                Picker("规则", selection: Binding(get: { coach.rule }, set: { coach.rule = $0; coach.analyze() })) {
                    ForEach(GameRule.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }.pickerStyle(.segmented)

                HStack {
                    Text("分析深度").font(.subheadline.bold())
                    Spacer()
                    Picker("分析深度", selection: Binding(get: { coach.depth }, set: coach.setDepth)) {
                        ForEach([8, 10, 12, 14, 16], id: \.self) { Text("\($0)").tag($0) }
                    }.pickerStyle(.menu)
                }
                Text("深度越高越准确，但手机耗时和耗电也会增加。对局中切换后，下一次分析立即采用新深度。")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func collapseButton(isExpanded: Binding<Bool>, label: String) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { isExpanded.wrappedValue.toggle() }
        } label: {
            Image(systemName: isExpanded.wrappedValue ? "chevron.up.circle.fill" : "chevron.down.circle.fill")
                .font(.title3)
                .foregroundStyle(green)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(isExpanded.wrappedValue ? "折叠" : "展开")\(label)")
    }
}

#Preview { ContentView() }
