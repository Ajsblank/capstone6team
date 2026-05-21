#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <chrono>
#include <random>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>
#include <signal.h>
#include <algorithm>
#include <cmath>

using namespace std;

struct Player {
    int id; string name; pid_t pid; int w_fd; int r_fd; int time_left;
    int pos[4]; int skills[2]; bool skill_left[2]; int saved_yut;
    Player(int _id, string _n) : id(_id), name(_n) {
        time_left = 10000; for(int i=0;i<4;i++) pos[i] = -1; 
        skill_left[0] = skill_left[1] = true; saved_yut = 0;
    }
};

Player start_bot(int id, string name, string cmd) {
    int p_in[2], p_out[2]; pipe(p_in); pipe(p_out);
    pid_t pid = fork();
    if (pid == 0) {
        dup2(p_in[0], 0); dup2(p_out[1], 1);
        close(p_in[0]); close(p_in[1]); close(p_out[0]); close(p_out[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr); exit(1);
    }
    close(p_in[0]); close(p_out[1]);
    Player p(id, name); p.pid = pid; p.w_fd = p_in[1]; p.r_fd = p_out[0]; return p;
}

void send_msg(Player& p, string msg) { 
    msg += "\n"; write(p.w_fd, msg.c_str(), msg.size()); 
}

string recv_msg(Player& p, int& time_used) {
    auto start = chrono::steady_clock::now(); string res = ""; char c; struct pollfd pfd; pfd.fd = p.r_fd; pfd.events = POLLIN;
    while (poll(&pfd, 1, max(1, p.time_left - time_used)) > 0) {
        if (read(p.r_fd, &c, 1) > 0) {
            if (c == '\n') break; if (c != '\r') res += c;
        } else break;
    }
    time_used = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
    return res.empty() ? "TIMEOUT" : res;
}

void kill_bot(Player& p) { kill(p.pid, SIGKILL); waitpid(p.pid, nullptr, 0); close(p.w_fd); close(p.r_fd); }

void player_loses(Player& loser, Player& winner, string reason) {
    cout << "\n❌ " << loser.name << " ERROR (" << reason << ")\n";
    cout << "🎉 " << winner.name << " WIN\n";
    send_msg(loser, "FINISH"); send_msg(winner, "FINISH");
    kill_bot(loser); kill_bot(winner); exit(0);
}

mt19937 gen(random_device{}());

int get_yut() {
    int r = gen() % 16;
    if (r == 0) return -1; if (r < 4) return 1; if (r < 10) return 2;
    if (r < 14) return 3; if (r == 14) return 4; return 5;
}

int step_forward(int u, bool first) {
    if (u == -1) return 1; if (u == 0) return 0; 
    if (first&&u==5) return 21; if (first&&u==10) return 24; if (first&&u==23) return 26;
    if (u==19||u==27) return 0;
    if (u==21) return 22; if (u==22) return 23; if (u==24) return 25; if (u==25) return 23; if (u==26) return 27;
    return u + 1;
}

int step_backward(int u) {
    if (u == -1 || u == 0) return u; if (u == 1) return 0;
    if (u==21) return 5; if (u==22) return 21; if (u==23) return 22;
    if (u==24) return 10; if (u==25) return 24; if (u==26) return 23; if (u==27) return 26;
    return u - 1;
}

bool has_valid_move(Player& cur, const vector<int>& yut_pool) {
    for (int y : yut_pool) {
        if (y > 0) return true;
        if (y < 0) {
            for (int i = 0; i < 4; i++) {
                if (cur.pos[i] > 0) return true; // 필드에 말이 있으면 빽도 가능
            }
        }
    }
    return false;
}

int main(int argc, char* argv[]) {
    if (argc != 3) { cerr << "Usage: ./judge <bot1> <bot2>\n"; return 1; }
    
    cout << "=== 초능력 윷놀이 (Hardcore Real-Rules) 배틀 시작 ===\n\n";

    Player p1 = start_bot(0, "FIRST", argv[1]); Player p2 = start_bot(1, "SECOND", argv[2]);
    Player* p[2] = {&p1, &p2};

    p1.skills[0]=gen()%8+1; p1.skills[1]=gen()%8+9; p2.skills[0]=gen()%8+1; p2.skills[1]=gen()%8+9;
    while(p1.skills[0]==p2.skills[0]) p2.skills[0]=gen()%8+1;
    while(p1.skills[1]==p2.skills[1]) p2.skills[1]=gen()%8+9;

    send_msg(p1, "READY FIRST"); send_msg(p2, "READY SECOND");
    
    int t1=0, t2=0;
    if (recv_msg(p1, t1) != "OK") player_loses(p1, p2, "READY Error");
    if (recv_msg(p2, t2) != "OK") player_loses(p2, p1, "READY Error");

    send_msg(p1, "INIT "+to_string(p1.skills[0])+" "+to_string(p1.skills[1])+" "+to_string(p2.skills[0])+" "+to_string(p2.skills[1]));
    send_msg(p2, "INIT "+to_string(p2.skills[0])+" "+to_string(p2.skills[1])+" "+to_string(p1.skills[0])+" "+to_string(p1.skills[1]));

    int turn = 0, bomb = 0, teleport = 0;
    
    while (turn < 200) {
        Player& cur = *p[turn%2]; Player& opp = *p[1-(turn%2)];
        
        bool can_roll = true, rolled_this_turn = false, skill_this_turn = false;
        vector<int> yut_pool; vector<string> opp_logs;
        
        bool double_buff = false, takeout = false, backstep = false;
        int force_roll_type = 0; 
        
        if (cur.saved_yut != 0) { yut_pool.push_back(cur.saved_yut); cur.saved_yut = 0; }

        cout << "\n---------------- [TURN " << turn + 1 << " : " << cur.name << "] ----------------\n";

        send_msg(cur, "TIME " + to_string(cur.time_left) + " " + to_string(opp.time_left));

        while (true) {
            if (cur.pos[0]==0 && cur.pos[1]==0 && cur.pos[2]==0 && cur.pos[3]==0) {
                cout << "\n🎉 RESULT: " << cur.name << " WIN!\n";
                send_msg(p1, "FINISH"); send_msg(p2, "FINISH"); kill_bot(p1); kill_bot(p2); return 0;
            }

            int t = 0; string res = recv_msg(cur, t); cur.time_left -= t;
            if (res == "TIMEOUT" || cur.time_left < 0) player_loses(cur, opp, "TLE");

            stringstream cmd(res); string action; 
            if (!(cmd >> action)) player_loses(cur, opp, "Format Error");

            if (action == "ROLL") {
                if (!can_roll) player_loses(cur, opp, "Cannot Roll");
                rolled_this_turn = true; can_roll = false;
                
                int y = 0;
                if (force_roll_type == 5) y = (gen() % 2) ? 1 : 5;
                else if (force_roll_type == 6) y = (gen() % 2) ? 4 : 5;
                else y = get_yut();
                
                force_roll_type = 0; 
                
                cout << cur.name << " ROLL " << y << "\n";
                opp_logs.push_back("ROLL " + to_string(y));
                
                if (takeout) { cur.saved_yut = y; takeout = false; if(y>=4) can_roll = true; }
                else if (backstep) { yut_pool.push_back(-abs(y)); backstep = false; if(y>=4) can_roll = true; }
                else if (double_buff) { yut_pool.push_back(y); yut_pool.push_back(y); double_buff = false; if(y>=4) can_roll=true; }
                else { yut_pool.push_back(y); if(y>=4) can_roll = true; }
                
                send_msg(cur, "ROLL_RESULT " + to_string(y));
            } 
            else if (action == "SKILL") {
                int id; if (!(cmd >> id)) player_loses(cur, opp, "SKILL Param Missing");
                if (rolled_this_turn || skill_this_turn) player_loses(cur, opp, "Skill Constraint Violation");
                
                if ((id == cur.skills[0] && cur.skill_left[0]) || (id == cur.skills[1] && cur.skill_left[1])) {
                    if (id == cur.skills[0]) cur.skill_left[0] = false; else cur.skill_left[1] = false;
                    skill_this_turn = true;
                    string log_str = "SKILL " + to_string(id);

                    if (id >= 9) {
                        int pa, pb; if (!(cmd >> pa >> pb)) player_loses(cur, opp, "Skill Target Missing");
                        log_str += " " + to_string(pa) + " " + to_string(pb);
                        
                        if(id==9) opp.pos[pb%4]=-1; 
                        else if(id==10) { for(int i=0;i<4;i++){ if(cur.pos[i]==-1){ cur.pos[i]=cur.pos[pa%4]; break; } } }
                        else if(id==11) swap(cur.pos[pa%4], opp.pos[pb%4]); 
                        else if(id==12) opp.pos[pb%4] = step_forward(cur.pos[pa%4], false);
                        else if(id==13) cur.pos[pa%4] = step_backward(opp.pos[pb%4]);
                        else if(id==14) teleport = pa; // 결승점 텔레포트 설치
                        else if(id==15) bomb = pa; // 지뢰 설치
                    } else {
                        if (id == 8) { // 백스텝 조건 검사: 필드에 말이 없으면 사용 불가
                            bool has_piece = false;
                            for(int i=0; i<4; i++) if(cur.pos[i] > 0) has_piece = true;
                            if (!has_piece) player_loses(cur, opp, "Cannot use Backstep without pieces");
                        }
                        
                        if(id==1){ yut_pool.push_back(1); yut_pool.push_back(2); can_roll = false; }
                        else if(id==2){ yut_pool.push_back(3); can_roll = false; }
                        else if(id==3){ yut_pool.push_back(-1); can_roll = false; }
                        else if(id==4){ double_buff=true; }
                        else if(id==5){ force_roll_type=5; }
                        else if(id==6){ force_roll_type=6; }
                        else if(id==7){ takeout=true; }
                        else if(id==8){ backstep=true; }
                    }
                    cout << cur.name << " " << log_str << "\n";
                    opp_logs.push_back(log_str);
                } else player_loses(cur, opp, "Invalid Skill");
            } 
            else if (action == "MOVE") {
                int pid, yut_val; if (!(cmd >> pid >> yut_val) || pid<0 || pid>3) player_loses(cur, opp, "MOVE Param Error");
                auto it = find(yut_pool.begin(), yut_pool.end(), yut_val);
                if (it == yut_pool.end()) player_loses(cur, opp, "Yut Not In Pool");
                if (cur.pos[pid] == 0) player_loses(cur, opp, "Move Finished Piece");
                if (cur.pos[pid] == -1 && yut_val < 0) player_loses(cur, opp, "Back-do from Wait State");

                string log_str = "MOVE " + to_string(pid) + " " + to_string(yut_val);
                cout << cur.name << " " << log_str << "\n";
                opp_logs.push_back(log_str);
                yut_pool.erase(it);
                
                int u = cur.pos[pid], start_pos = u;
                vector<int> stacked; for(int i=0;i<4;i++) if(cur.pos[i]==u && u!=-1) stacked.push_back(i);
                if (stacked.empty()) stacked.push_back(pid);

                if (yut_val > 0) for(int i=0;i<yut_val;i++) u = step_forward(u, i==0);
                else if (yut_val < 0) for(int i=0;i<-yut_val;i++) u = step_backward(u);

                if (bomb > 0 && ((yut_val>0 && start_pos<=bomb && u>=bomb) || (yut_val<0 && start_pos>=bomb && u<=bomb))) {
                    u = -1; bomb = 0;
                } else if (teleport > 0 && u == teleport) {
                    u = 0; teleport = 0;
                }
                
                for (int i : stacked) cur.pos[i] = u;

                if (u > 0 && u < 20) {
                    bool caught = false;
                    for(int i=0;i<4;i++) if(opp.pos[i]==u) { opp.pos[i]=-1; caught=true; }
                    if (caught) can_roll = true; 
                }
            } 
            else if (action == "PASS") {
                if (can_roll || has_valid_move(cur, yut_pool)) player_loses(cur, opp, "PASS with Actions Left");
                break; 
            } else player_loses(cur, opp, "Unknown Command");
        }
        
        if (!opp_logs.empty()) {
            string opp_msg = "OPP " + to_string(opp_logs.size());
            for(string& l : opp_logs) opp_msg += "\n" + l;
            send_msg(opp, opp_msg);
        } else {
            send_msg(opp, "OPP 0");
        }
        turn++;
    }
    
    cout << "\n=== 최대 턴 도달 무승부 ===\n";
    send_msg(p1, "FINISH"); send_msg(p2, "FINISH");
    kill_bot(p1); kill_bot(p2); return 0;
}