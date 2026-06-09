#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <set>
#include <random>

using namespace std;

bool DEBUG_MODE = false;

// 디버그 로그 출력 함수 (표준 에러 스트림을 사용하여 채점 파이프라인에 영향이 없도록 함)
void log_msg(const string& msg) {
    if (DEBUG_MODE) {
        cerr << msg << endl;
    }
}

// -----------------------------------------------------------------------------
// 기본 데이터 구조 및 함수 선언
// -----------------------------------------------------------------------------
struct Move {
    int r1, c1, r2, c2;

    bool operator==(const Move& o) const {
        return r1 == o.r1 && c1 == o.c1 && r2 == o.r2 && c2 == o.c2;
    }
    bool operator<(const Move& o) const {
        if (r1 != o.r1) return r1 < o.r1;
        if (c1 != o.c1) return c1 < o.c1;
        if (r2 != o.r2) return r2 < o.r2;
        return c2 < o.c2;
    }
};

const Move PASS_MOVE = {-1, -1, -1, -1};

int getGameScore(const vector<vector<int>>& board);
void update_move(vector<vector<int>>& board, Move action, bool _isMyMove);
void flip_board(vector<vector<int>>& board);
bool isValid(const vector<vector<int>>& board, int r1, int c1, int r2, int c2);
int sumNumber(const vector<vector<int>>& board, int r1, int c1, int r2, int c2);
vector<Move> getAllSelectableMoves(const vector<vector<int>>& board);
vector<Move> getAfterMoves(const vector<vector<int>>& board, Move move, bool newOnly);
int worst_case_scenario_score(const vector<vector<int>>& board, Move move, bool newOnly);
void all_move_simultaion(const vector<vector<int>>& board, Move move, bool newOnly, vector<Move> moves, vector<vector<Move>>& allScenario);
void log_board(const vector<vector<int>>& board);
vector<Move> get_dead_moves(const vector<vector<int>>& board);

// -----------------------------------------------------------------------------
// Game 클래스
// -----------------------------------------------------------------------------
class Game {
public:
    vector<vector<int>> board;
    bool first;
    bool passed;

    Game() : first(false), passed(false) {}

    Game(const vector<vector<int>>& b, bool f) : board(b), first(f), passed(false) {}

    Move calculateMove(int _myTime, int _oppTime) {
        if (getGameScore(board) > 0 && passed) {
            return PASS_MOVE;
        }

        Move bestMove = PASS_MOVE;
        int bestScore = 0;
        int maxWorstCaseScenarioScore = -999;

        vector<Move> allMoves = getAllSelectableMoves(board);
        vector<Move> deadMoves = get_dead_moves(board);

        if (!deadMoves.empty()) {
            log_msg("죽은 수가 존재함으로 먼저 선점[" + to_string(deadMoves.size()) + "]");
            for (const Move& move : deadMoves) {
                int dscore = 0;
                for (int r = move.r1; r <= move.r2; ++r) {
                    for (int c = move.c1; c <= move.c2; ++c) {
                        if (board[r][c] >= 0) dscore += 1;
                        else if (board[r][c] == -1) dscore += 2;
                    }
                }
                if (bestScore < dscore) {
                    bestScore = dscore;
                    bestMove = move;
                }
            }
        } else {
            log_msg("백트랙킹 실행, 총 탐색할 경우의 수[" + to_string(allMoves.size()) + "]");
            for (const Move& move : allMoves) {
                bool newOnly = allMoves.size() > 4;
                int worstCaseScenarioScore = worst_case_scenario_score(board, move, newOnly);
                
                if (maxWorstCaseScenarioScore < worstCaseScenarioScore) {
                    maxWorstCaseScenarioScore = worstCaseScenarioScore;
                    if (maxWorstCaseScenarioScore < 0 && getGameScore(board) > 0) continue;
                    
                    int reactSize = (move.r2 - move.r1 + 1) * (move.c2 - move.c1 + 1);
                    if (bestScore < reactSize) {
                        bestScore = reactSize;
                        bestMove = move;
                    }
                }
            }
        }

        return bestMove;
    }

    void updateOpponentAction(Move action, int _time) {
        updateMove(action.r1, action.c1, action.r2, action.c2, false);
    }

    void updateMove(int r1, int c1, int r2, int c2, bool _isMyMove) {
        if (r1 == -1 && c1 == -1 && r2 == -1 && c2 == -1) {
            passed = true;
            return;
        }
        for (int r = r1; r <= r2; ++r) {
            for (int c = c1; c <= c2; ++c) {
                if (_isMyMove) board[r][c] = 0;
                else board[r][c] = -1;
            }
        }
        passed = false;
    }
};

// -----------------------------------------------------------------------------
// 헬퍼 함수 구현
// -----------------------------------------------------------------------------
bool isValid(const vector<vector<int>>& board, int r1, int c1, int r2, int c2) {
    int sums = 0;
    bool r1fit = false, c1fit = false, r2fit = false, c2fit = false;
    for (int r = r1; r <= r2; ++r) {
        for (int c = c1; c <= c2; ++c) {
            if (board[r][c] > 0) {
                sums += board[r][c];
                if (r == r1) r1fit = true;
                if (r == r2) r2fit = true;
                if (c == c1) c1fit = true;
                if (c == c2) c2fit = true;
            }
        }
    }
    return sums == 10 && r1fit && r2fit && c1fit && c2fit;
}

int sumNumber(const vector<vector<int>>& board, int r1, int c1, int r2, int c2) {
    int sums = 0;
    for (int r = r1; r <= r2; ++r) {
        for (int c = c1; c <= c2; ++c) {
            if (board[r][c] > 0) sums += board[r][c];
        }
    }
    return sums;
}

vector<Move> getAllSelectableMoves(const vector<vector<int>>& board) {
    vector<Move> result;
    int ROWS = board.size();
    if (ROWS == 0) return result;
    int COLS = board[0].size();

    for (int r1 = 0; r1 < ROWS; ++r1) {
        for (int c1 = 0; c1 < COLS; ++c1) {
            for (int r2 = r1; r2 < ROWS; ++r2) {
                bool moved = false;
                for (int c2 = c1; c2 < COLS; ++c2) {
                    int num = sumNumber(board, r1, c1, r2, c2);
                    if (num > 10) {
                        break;
                    } else if (num < 10) {
                        moved = true;
                    } else if (num == 10) {
                        if (isValid(board, r1, c1, r2, c2)) {
                            result.push_back({r1, c1, r2, c2});
                        } else {
                            break;
                        }
                    }
                }
                if (!moved) break;
            }
        }
    }
    return result;
}

vector<Move> getAfterMoves(const vector<vector<int>>& board, Move move, bool newOnly) {
    if (move == PASS_MOVE) return getAllSelectableMoves(board);

    vector<Move> bMovesList = getAllSelectableMoves(board);
    set<Move> beforeMoves(bMovesList.begin(), bMovesList.end());

    vector<vector<int>> tmpBoard = board;
    for (int r = move.r1; r <= move.r2; ++r) {
        for (int c = move.c1; c <= move.c2; ++c) {
            tmpBoard[r][c] = 0;
        }
    }

    vector<Move> aMovesList = getAllSelectableMoves(tmpBoard);
    set<Move> afterMoves(aMovesList.begin(), aMovesList.end());

    vector<Move> newMovesList;
    for (const Move& m : afterMoves) {
        if (beforeMoves.find(m) == beforeMoves.end()) {
            newMovesList.push_back(m);
        }
    }

    if (newOnly) return newMovesList;

    set<Move> affectedMoves(newMovesList.begin(), newMovesList.end());
    for (const Move& m : afterMoves) {
        if (!(m.r2 < move.r1 - 1 || m.r1 > move.r2 + 1 || m.c2 < move.c1 - 1 || m.c1 > move.c2 + 1)) {
            affectedMoves.insert(m);
        }
    }

    return vector<Move>(affectedMoves.begin(), affectedMoves.end());
}

int getGameScore(const vector<vector<int>>& board) {
    int score = 0;
    for (int r = 0; r < board.size(); ++r) {
        for (int c = 0; c < board[0].size(); ++c) {
            if (board[r][c] == 0) score += 1;
            else if (board[r][c] < 0) score -= 1;
        }
    }
    return score;
}

void update_move(vector<vector<int>>& board, Move action, bool _isMyMove) {
    if (action == PASS_MOVE) return;
    for (int r = action.r1; r <= action.r2; ++r) {
        for (int c = action.c1; c <= action.c2; ++c) {
            board[r][c] = _isMyMove ? 0 : -1;
        }
    }
}

void flip_board(vector<vector<int>>& board) {
    for (int r = 0; r < board.size(); ++r) {
        for (int c = 0; c < board[0].size(); ++c) {
            if (board[r][c] == 0) board[r][c] = -1;
            else if (board[r][c] == -1) board[r][c] = 0;
        }
    }
}

void all_move_simultaion(const vector<vector<int>>& board, Move move, bool newOnly, vector<Move> moves, vector<vector<Move>>& allScenario) {
    moves.push_back(move);
    vector<vector<int>> tempBoard = board;
    update_move(tempBoard, move, true);
    flip_board(tempBoard); 

    vector<Move> nextMoves = getAfterMoves(board, move, newOnly);

    if (nextMoves.empty()) {
        allScenario.push_back(moves);
        return;
    }

    for (const Move& nextMove : nextMoves) {
        all_move_simultaion(tempBoard, nextMove, newOnly, moves, allScenario);
    }
}

int worst_case_scenario_score(const vector<vector<int>>& board, Move move, bool newOnly) {
    vector<vector<Move>> allScenario;
    all_move_simultaion(board, move, newOnly, {}, allScenario);
    log_msg("Scenario Size: " + to_string(allScenario.size()));

    int worstScore = 999;

    for (const auto& scenario : allScenario) {
        vector<vector<int>> tempBoard = board;
        bool myturn = true;
        for (const Move& m : scenario) {
            update_move(tempBoard, m, myturn);
            myturn = !myturn;
        }
        int curScore = getGameScore(tempBoard);
        if (worstScore > curScore) {
            log_msg("최악의 시나리오 발견! 최종결과[" + to_string(curScore) + "]");
            worstScore = curScore;
        }
    }
    return worstScore;
}

void log_board(const vector<vector<int>>& board) {
    log_msg("##########################################################");
    for (int r = 0; r < board.size(); ++r) {
        string row_str = "";
        for (int c = 0; c < board[0].size(); ++c) {
            int val = board[r][c];
            if (val == 0) row_str += " *";
            else if (val == -1) row_str += " @";
            else row_str += " " + to_string(val);
        }
        log_msg(row_str);
    }
    log_msg("점수: " + to_string(getGameScore(board)));
    log_msg("##########################################################");
}

vector<Move> get_dead_moves(const vector<vector<int>>& board) {
    vector<Move> result;
    vector<Move> allMoves = getAllSelectableMoves(board);
    for (const Move& move : allMoves) {
        if (getAfterMoves(board, move, true).empty()) {
            result.push_back(move);
        }
    }
    return result;
}

// -----------------------------------------------------------------------------
// 메인 함수
// -----------------------------------------------------------------------------
int main(int argc, char* argv[]) {
    for (int i = 1; i < argc; ++i) {
        if (string(argv[i]) == "--debug") {
            DEBUG_MODE = true;
        }
    }

    Game game;
    bool first = false;
    double gameTurn = 0;

    string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;

        stringstream ss(line);
        string command;
        ss >> command;

        vector<string> param;
        string p;
        while (ss >> p) {
            param.push_back(p);
        }

        if (command == "READY") {
            string turn = param[0];
            first = (turn == "FIRST");
            cout << "OK" << endl;
            continue;
        }

        if (command == "INIT") {
            gameTurn = 0;
            vector<vector<int>> board(10, vector<int>(17));
            for (int r = 0; r < 10 && r < param.size(); ++r) {
                for (int c = 0; c < 17 && c < param[r].length(); ++c) {
                    board[r][c] = param[r][c] - '0';
                }
            }
            game = Game(board, first);
            continue;
        }

        if (command == "TIME") {
            gameTurn += 1.0;
            int myTime = stoi(param[0]);
            int oppTime = stoi(param[1]);
            Move ret = game.calculateMove(myTime, oppTime);
            game.updateMove(ret.r1, ret.c1, ret.r2, ret.c2, true);
            cout << ret.r1 << " " << ret.c1 << " " << ret.r2 << " " << ret.c2 << endl;
            continue;
        }

        if (command == "OPP") {
            int r1 = stoi(param[0]), c1 = stoi(param[1]), r2 = stoi(param[2]), c2 = stoi(param[3]), time = stoi(param[4]);
            game.updateOpponentAction({r1, c1, r2, c2}, time);
            continue;
        }

        if (command == "FIRST") {
            gameTurn += 0.5;
            int r1 = stoi(param[0]), c1 = stoi(param[1]), r2 = stoi(param[2]), c2 = stoi(param[3]), time = stoi(param[4]);
            game.updateMove(r1, c1, r2, c2, first);
            continue;
        }

        if (command == "SECOND") {
            gameTurn += 0.5;
            int r1 = stoi(param[0]), c1 = stoi(param[1]), r2 = stoi(param[2]), c2 = stoi(param[3]), time = stoi(param[4]);
            game.updateMove(r1, c1, r2, c2, !first);
            continue;
        }

        if (command == "SHOW") {
            log_board(game.board);
            continue;
        }

        if (command == "1") {
            Move ret = game.calculateMove(1, 1);
            game.updateMove(ret.r1, ret.c1, ret.r2, ret.c2, true);
            log_board(game.board);
            flip_board(game.board);
            cout << ret.r1 << " " << ret.c1 << " " << ret.r2 << " " << ret.c2 << endl;
            gameTurn += 0.5;
            continue;
        }

        if (command == "2") {
            gameTurn = 0;
            random_device rd;
            mt19937 gen(rd());
            uniform_int_distribution<int> dis(1, 9);
            
            vector<vector<int>> board(10, vector<int>(17));
            for (int r = 0; r < 10; ++r) {
                for (int c = 0; c < 17; ++c) {
                    board[r][c] = dis(gen);
                }
            }
            game = Game(board, true);
            continue;
        }

        if (command == "FINISH") {
            break;
        }

        cerr << "Invalid command " << command << endl;
        exit(1);
    }

    return 0;
}
