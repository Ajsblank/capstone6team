#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <cstdint>
#include <array>
#include <optional>
#include <bit>

constexpr int R = 10;
constexpr int C = 17;

struct MushroomBoard {
    std::array<std::array<uint8_t, R>, C> board{};

    MushroomBoard() = default;

    MushroomBoard(const std::array<std::array<uint8_t, C>, R>& input_board) {
        for (int r = 0; r < R; ++r) {
            for (int c = 0; c < C; ++c) {
                board[c][r] = input_board[r][c];
            }
        }
    }
};

struct MushroomMove {
    int r1, r2; // [r1, r2)
    int c1, c2; // [c1, c2)
};

struct MushroomState {
    std::array<uint16_t, C> my{};
    std::array<uint16_t, C> opp{};

    MushroomState() = default;

    inline bool is_empty(int r, int c) const {
        return ((my[c] | opp[c]) & (1 << r)) != 0;
    }

    inline bool is_my_cell(int r, int c) const {
        return (my[c] & (1 << r)) != 0;
    }

    inline bool is_opp_cell(int r, int c) const {
        return (opp[c] & (1 << r)) != 0;
    }

    uint8_t count_opp_cells(const MushroomMove& mv) const {
        uint16_t bitmask = ((1 << mv.r2) - (1 << mv.r1));
        uint8_t count = 0;
        for (int c = mv.c1; c < mv.c2; ++c) {
            // std::popcount 대신 __builtin_popcount 사용
            count += __builtin_popcount(opp[c] & bitmask);
        }
        return count;
    }

    uint8_t count_opp_cells_all() const {
        uint8_t count = 0;
        for (int c = 0; c < C; ++c) {
            count += __builtin_popcount(opp[c]);
        }
        return count;
    }

    uint8_t count_my_cells(const MushroomMove& mv) const {
        uint16_t bitmask = ((1 << mv.r2) - (1 << mv.r1));
        uint8_t count = 0;
        for (int c = mv.c1; c < mv.c2; ++c) {
            count += __builtin_popcount(my[c] & bitmask);
        }
        return count;
    }

    uint8_t count_my_cells_all() const {
        uint8_t count = 0;
        for (int c = 0; c < C; ++c) {
            count += __builtin_popcount(my[c]);
        }
        return count;
    }

    bool is_valid_move_naive(const MushroomBoard& board, const MushroomMove& mv) const {
        bool r1_hit = false;
        bool r2_hit = false;
        bool c1_hit = false;
        bool c2_hit = false;
        int sum = 0;

        for (int c = mv.c1; c < mv.c2; ++c) {
            for (int r = mv.r1; r < mv.r2; ++r) {
                if (!is_empty(r, c)) {
                    sum += board.board[c][r];
                    if (sum > 10) return false;
                    if (r == mv.r1) r1_hit = true;
                    if (r == mv.r2 - 1) r2_hit = true;
                    if (c == mv.c1) c1_hit = true;
                    if (c == mv.c2 - 1) c2_hit = true;
                }
            }
        }
        return sum == 10 && r1_hit && r2_hit && c1_hit && c2_hit;
    }

    void apply_move(bool is_my, const MushroomMove& mv) {
        uint16_t bitmask = ((1 << mv.r2) - (1 << mv.r1));
        if (is_my) {
            for (int c = mv.c1; c < mv.c2; ++c) {
                my[c] |= bitmask;
                opp[c] &= ~bitmask;
            }
        } else {
            for (int c = mv.c1; c < mv.c2; ++c) {
                opp[c] |= bitmask;
                my[c] &= ~bitmask;
            }
        }
    }
};

struct MushroomStateWithRowPrefixSum {
    MushroomState state;
    std::array<std::array<uint8_t, R>, C> num_prefix_sum{};

    MushroomStateWithRowPrefixSum() = default;

    MushroomStateWithRowPrefixSum(const MushroomBoard& board, const MushroomState& init_state)
        : state(init_state) {
        for (int c = 0; c < C; ++c) {
            for (int r = 0; r < R; ++r) {
                uint8_t prev = (r == 0) ? 0 : num_prefix_sum[c][r - 1];
                uint8_t cell_val = state.is_empty(r, c) ? 0 : board.board[c][r];
                num_prefix_sum[c][r] = prev + cell_val;
            }
        }
    }

    inline uint8_t get_prefix_sum(int r1, int r2, int col) const {
        uint8_t val2 = num_prefix_sum[col][r2 - 1];
        uint8_t val1 = (r1 == 0) ? 0 : num_prefix_sum[col][r1 - 1];
        return val2 - val1;
    }

    void apply_move(const MushroomBoard& board, bool is_my, const MushroomMove& mv) {
        state.apply_move(is_my, mv);

        for (int c = mv.c1; c < mv.c2; ++c) {
            uint8_t prev_value = (mv.r1 == 0) ? 0 : num_prefix_sum[c][mv.r1 - 1];
            for (int r = mv.r1; r < mv.r2; ++r) {
                num_prefix_sum[c][r] = prev_value;
            }

            for (int r = mv.r2; r < R; ++r) {
                uint8_t cell_val = state.is_empty(r, c) ? 0 : board.board[c][r];
                num_prefix_sum[c][r] = num_prefix_sum[c][r - 1] + cell_val;
            }
        }
    }
};

class MoveIterator {
    const MushroomStateWithRowPrefixSum* inner;
    int r1 = 0, r2 = 1, c1 = 0, c2 = 0;
    uint8_t up_fit = 0, down_fit = 0, score = 0;

public:
    MoveIterator(const MushroomStateWithRowPrefixSum* state) : inner(state) {}

    inline bool end() const {
        return r1 == R;
    }

    std::optional<MushroomMove> step() {
        if (r2 > R) {
            r1++;
            r2 = r1 + 1;
            c1 = 0;
            c2 = 0;
            up_fit = 0;
            down_fit = 0;
            score = 0;
            return std::nullopt;
        }

        std::optional<MushroomMove> ret = std::nullopt;

        if (score < 10) {
            if (c2 == C) {
                r2++;
                c1 = 0;
                c2 = 0;
                up_fit = 0;
                down_fit = 0;
                score = 0;
                return std::nullopt;
            }
            if (!inner->state.is_empty(r1, c2)) {
                up_fit++;
            }
            if (!inner->state.is_empty(r2 - 1, c2)) {
                down_fit++;
            }
            score += inner->get_prefix_sum(r1, r2, c2);
            c2++;

            if (score == 0) {
                c1++;
            }

            if (score == 10 && up_fit >= 1 && down_fit >= 1) {
                ret = MushroomMove{r1, r2, c1, c2};
            } else {
                return std::nullopt;
            }
        }

        if (score >= 10) {
            bool prev_ok = (score == 10 && up_fit >= 1 && down_fit >= 1);
            if (!inner->state.is_empty(r1, c1)) {
                up_fit--;
            }
            if (!inner->state.is_empty(r2 - 1, c1)) {
                down_fit--;
            }
            score -= inner->get_prefix_sum(r1, r2, c1);

            if (score < 10 && prev_ok) {
                ret = MushroomMove{r1, r2, c1, c2};
            }
            c1++;

            if (score != 0) {
                while (inner->get_prefix_sum(r1, r2, c1) == 0) {
                    if (!inner->state.is_empty(r1, c1)) {
                        up_fit--;
                    }
                    if (!inner->state.is_empty(r2 - 1, c1)) {
                        down_fit--;
                    }
                    score -= inner->get_prefix_sum(r1, r2, c1);
                    c1++;
                }
            }
        }
        return ret;
    }

    std::optional<MushroomMove> next() {
        while (!end()) {
            if (auto mv = step()) {
                return mv;
            }
        }
        return std::nullopt;
    }
};

int16_t alpha_beta_search(uint8_t depth, int16_t alpha, int16_t beta, bool maximize,
                          const MushroomBoard& board, MushroomStateWithRowPrefixSum current_state) {
    if (depth == 0) {
        int16_t current_score = static_cast<int16_t>(current_state.state.count_my_cells_all()) 
                              - static_cast<int16_t>(current_state.state.count_opp_cells_all());
        int16_t best_value = std::clamp(current_score, alpha, beta);
        
        if (maximize && best_value >= beta) return beta;
        if (!maximize && best_value <= alpha) return alpha;

        MoveIterator it(&current_state);
        while (auto mv_opt = it.next()) {
            MushroomMove mv = *mv_opt;
            int16_t area = (mv.r2 - mv.r1) * (mv.c2 - mv.c1);
            int16_t my_cells = current_state.state.count_my_cells(mv);
            int16_t opp_cells = current_state.state.count_opp_cells(mv);

            if (maximize) {
                best_value = std::max(best_value, static_cast<int16_t>((area - my_cells + opp_cells) + current_score));
                if (best_value >= beta) return beta;
            } else {
                best_value = std::min(best_value, static_cast<int16_t>(-(area - opp_cells + my_cells) + current_score));
                if (best_value <= alpha) return alpha;
            }
        }
        return best_value;
    }

    int16_t best_value = std::clamp(alpha_beta_search(depth - 1, alpha, beta, !maximize, board, current_state), alpha, beta);

    if (maximize && best_value >= beta) return beta;
    if (!maximize && best_value <= alpha) return alpha;

    MoveIterator it(&current_state);
    while (auto mv_opt = it.next()) {
        MushroomStateWithRowPrefixSum new_state = current_state;
        new_state.apply_move(board, maximize, *mv_opt);

        if (maximize) {
            best_value = std::max(best_value, alpha_beta_search(depth - 1, best_value, beta, !maximize, board, new_state));
            if (best_value >= beta) return beta;
        } else {
            best_value = std::min(best_value, alpha_beta_search(depth - 1, alpha, best_value, !maximize, board, new_state));
            if (best_value <= alpha) return alpha;
        }
    }
    return best_value;
}

std::optional<MushroomMove> get_my_move(uint8_t depth, bool is_prev_pass, 
                                        const MushroomBoard& board, 
                                        const MushroomStateWithRowPrefixSum& state) {
    if (is_prev_pass) {
        uint8_t my_cells = state.state.count_my_cells_all();
        uint8_t opp_cells = state.state.count_opp_cells_all();
        if (my_cells > opp_cells) {
            return std::nullopt;
        }
    }

    int16_t best_value = alpha_beta_search(depth, INT16_MIN, INT16_MAX, false, board, state);
    std::optional<MushroomMove> best_move = std::nullopt;

    MoveIterator it(&state);
    while (auto mv_opt = it.next()) {
        MushroomStateWithRowPrefixSum new_state = state;
        new_state.apply_move(board, true, *mv_opt);
        
        int16_t value = alpha_beta_search(depth, best_value, INT16_MAX, false, board, new_state);
        if (best_value < value) {
            best_value = value;
            best_move = mv_opt;
        }
    }

    return best_move;
}

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string line;
    std::optional<std::pair<MushroomBoard, MushroomStateWithRowPrefixSum>> game_state = std::nullopt;
    bool prev_pass = false;

    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        std::stringstream ss(line);
        std::string command;
        if (!(ss >> command)) continue;

        if (command == "READY") {
            std::string turn;
            ss >> turn;
            std::cout << "OK" << std::endl;
        } else if (command == "INIT") {
            std::array<std::array<uint8_t, C>, R> initial_board;
            for (int r = 0; r < R; ++r) {
                std::string row_str;
                ss >> row_str;
                for (int c = 0; c < C; ++c) {
                    initial_board[r][c] = row_str[c] - '0';
                }
            }
            MushroomBoard board(initial_board);
            MushroomState state;
            MushroomStateWithRowPrefixSum state_sum(board, state);
            game_state = std::make_pair(board, state_sum);
        } else if (command == "TIME") {
            int my_time, opp_time;
            ss >> my_time >> opp_time;
            
            auto& board = game_state->first;
            auto& state = game_state->second;
            
            std::optional<MushroomMove> ret = get_my_move(3, prev_pass, board, state);
            if (ret) {
                state.apply_move(board, true, *ret);
                std::cout << ret->r1 << " " << ret->c1 << " " << (ret->r2 - 1) << " " << (ret->c2 - 1) << std::endl;
            } else {
                std::cout << "-1 -1 -1 -1" << std::endl;
            }
        } else if (command == "OPP") {
            int r1, c1, r2, c2, time;
            ss >> r1 >> c1 >> r2 >> c2 >> time;
            
            bool is_pass = (r1 == -1 && c1 == -1 && r2 == -1 && c2 == -1);
            if (!is_pass) {
                auto& board = game_state->first;
                auto& state = game_state->second;
                state.apply_move(board, false, MushroomMove{r1, r2 + 1, c1, c2 + 1});
            }
            prev_pass = is_pass;
        } else if (command == "FINISH") {
            break;
        }
    }

    return 0;
}