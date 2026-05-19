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
#include <cmath>
#include <algorithm>

using namespace std;

struct Player {
    int id; string name; pid_t pid; int w_fd; int r_fd; int time_left;
    int pos[4]; int skills[2]; bool skill_left[2]; int saved_yut;
    Player(int _id, string _n) : id(_id), name(_n) {
        time_left = 10000; for(int i=0;i<4;i++) pos[i] = -1; // -1: 대기상태
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

// 🟢 시스템 -> 봇으로 보내는 메시지 로깅
void send_msg(Player& p, string msg) { 
    cout << "\033[36m[Judge ➡️ " << p.name << "]\033[0m " << msg << "\n"; // Cyan color
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
    cout << "\n❌ [ABORT] " << loser.name << " 반칙/에러 패배! 사유: " << reason << "\n";
    cout << "🎉 RESULT: " << winner.name << " 승리!\n";
    send_msg(loser, "FINISH"); send_msg(winner, "FINISH");
    kill_bot(loser); kill_bot(winner);
    exit(0);
}

mt19937 gen(random_device{}());
int get_yut() {
    int r = gen() % 16;
    if (r==0) return 0; if (r<3) return -1; if (r<7) return 1;
    if (r<11) return 2; if (r<14) return 3; if (r<15) return 4; return 5;
}

int get_next(int u, bool first) {
    if (u == -1) return 1;
    if (u == 0) return 0; 
    if (first&&u==5) return 21; if (first&&u==10) return 24; if (first&&u==23) return 26;
    if (u==19||u==27) return 0;
    if (u==21) return 22; if (u==22) return 23; if (u==24) return 25; if (u==25) return 23; if (u==26) return 27;
    return u + 1;
}

int get_prev(int u) {
    if (u == -1 || u == 0) return u;
    if (u == 1) return 0;
    if (u==21) return 5; if (u==22) return 21; if (u==23) return 22;
    if (u==24) return 10; if (u==25) return 24; if (u==26) return 23; if (u==27) return 26;
    return u - 1;
}

int main(int argc, char* argv[]) {
    if (argc != 3) {
        cerr << "Usage: ./judge <bot1> <bot2>\n";
        return 1;
    }
    
    cout << "=== 초능력 윷놀이 (Hardcore Real-Rules) 배틀 시작 ===\n\n";

    Player p1 = start_bot(0, "FIRST", argv[1]); Player p2 = start_bot(1, "SECOND", argv[2]);
    Player* p[2] = {&p1, &p2};

    p1.skills[0]=gen()%8+1; p1.skills[1]=gen()%8+9; p2.skills[0]=gen()%8+1; p2.skills[1]=gen()%8+9;
    while(p1.skills[0]==p2.skills[0]) p2.skills[0]=gen()%8+1;
    while(p1.skills[1]==p2.skills[1]) p2.skills[1]=gen()%8+9;

    send_msg(p1, "READY FIRST"); send_msg(p2, "READY SECOND");
    
    int t1=0, t2=0;
    string r1 = recv_msg(p1, t1);
    cout << "\033[33m[" << p1.name << " ➡️ Judge]\033[0m " << r1 << " (" << t1 << "ms)\n";
    if (r1 != "OK") player_loses(p1, p2, "READY 응답 에러");

    string r2 = recv_msg(p2, t2);
    cout << "\033[33m[" << p2.name << " ➡️ Judge]\033[0m " << r2 << " (" << t2 << "ms)\n";
    if (r2 != "OK") player_loses(p2, p1, "READY 응답 에러");

    send_msg(p1, "INIT "+to_string(p1.skills[0])+" "+to_string(p1.skills[1])+" "+to_string(p2.skills[0])+" "+to_string(p2.skills[1]));
    send_msg(p2, "INIT "+to_string(p2.skills[0])+" "+to_string(p2.skills[1])+" "+to_string(p1.skills[0])+" "+to_string(p1.skills[1]));

    int turn = 0, bomb = 0;
    bool double_buff = false, takeout = false, backstep = false;
    
    while (turn < 100) {
        Player& cur = *p[turn%2]; Player& opp = *p[1-(turn%2)];
        bool can_roll = true, rolled_this_turn = false, skill_this_turn = false;
        vector<int> yut_pool;
        if (cur.saved_yut != 0) { yut_pool.push_back(cur.saved_yut); cur.saved_yut = 0; }

        cout << "\n---------------- [TURN " << turn + 1 << " : " << cur.name << "] ----------------\n";

        while (true) {
            bool turn_over = false;
            if (cur.pos[0]==0 && cur.pos[1]==0 && cur.pos[2]==0 && cur.pos[3]==0) {
                cout << "\n🎉 RESULT: " << cur.name << " 4말 모두 골인 승리!\n";
                send_msg(p1, "FINISH"); send_msg(p2, "FINISH"); kill_bot(p1); kill_bot(p2); return 0;
            }

            stringstream ss;
            ss << "REQ " << cur.time_left << " " << opp.time_left << " " << can_roll << " " << rolled_this_turn << " " << skill_this_turn << " "
               << cur.skill_left[0] << " " << cur.skill_left[1] << " " << opp.skill_left[0] << " " << opp.skill_left[1] << " " << bomb << " ";
            for(int i=0;i<4;i++) ss << cur.pos[i] << " "; for(int i=0;i<4;i++) ss << opp.pos[i] << " ";
            ss << yut_pool.size(); for(int y : yut_pool) ss << " " << y;
            
            send_msg(cur, ss.str());

            int t = 0; 
            string res = recv_msg(cur, t); cur.time_left -= t;
            
            // 🟡 봇 -> 시스템 응답 로깅
            if (res == "TIMEOUT" || cur.time_left < 0) {
                cout << "\033[33m[" << cur.name << " ➡️ Judge]\033[0m (TIMEOUT / TLE)\n";
                player_loses(cur, opp, "시간 초과 (TLE)");
            } else {
                cout << "\033[33m[" << cur.name << " ➡️ Judge]\033[0m " << res << " (" << t << "ms)\n";
            }

            stringstream cmd(res); string action; 
            if (!(cmd >> action)) player_loses(cur, opp, "잘못된 출력 포맷");

            if (action == "ROLL") {
                if (!can_roll) player_loses(cur, opp, "윷을 굴릴 수 없는 상태에서 ROLL 시도");
                rolled_this_turn = true; can_roll = false;
                int y = get_yut();
                cout << "🎲 윷 결과: " << y << "\n";
                
                if (takeout) { cur.saved_yut = y; takeout = false; }
                else if (backstep) { yut_pool.push_back(-abs(y)); backstep = false; }
                else if (double_buff) { yut_pool.push_back(y); yut_pool.push_back(y); double_buff = false; if(y>=4) can_roll=true; }
                else { yut_pool.push_back(y); if(y>=4) can_roll = true; }
            } 
            else if (action == "SKILL") {
                int id, pa, pb; 
                if (!(cmd >> id >> pa >> pb)) player_loses(cur, opp, "SKILL 파라미터 누락");
                if (rolled_this_turn || skill_this_turn) player_loses(cur, opp, "스킬 사용 조건 위반(이미 윷 굴림 or 스킬 중복)");
                
                if ((id == cur.skills[0] && cur.skill_left[0]) || (id == cur.skills[1] && cur.skill_left[1])) {
                    if (id == cur.skills[0]) cur.skill_left[0] = false; else cur.skill_left[1] = false;
                    skill_this_turn = true;
                    if(id==1){yut_pool.push_back(1); yut_pool.push_back(2);}
                    else if(id==2)yut_pool.push_back(3); else if(id==3)yut_pool.push_back(-1);
                    else if(id==4)double_buff=true; else if(id==5){int y=(gen()%2)?1:5; yut_pool.push_back(y); if(y==5)can_roll=true;}
                    else if(id==6){int y=(gen()%2)?4:5; yut_pool.push_back(y); can_roll=true;} else if(id==7)takeout=true;
                    else if(id==8)backstep=true; else if(id==9)opp.pos[pb%4]=-1; 
                    else if(id==10) { 
                        for(int i=0;i<4;i++){ if(cur.pos[i]==-1){ cur.pos[i]=cur.pos[pa%4]; break; } }
                    }
                    else if(id==11)swap(cur.pos[pa%4], opp.pos[pb%4]); else if(id==12)opp.pos[pb%4]=get_next(cur.pos[pa%4], false);
                    else if(id==13)cur.pos[pa%4]=get_prev(opp.pos[pb%4]);
                    else if(id==14){for(int i=0;i<4;i++){if(cur.pos[i]>0&&cur.pos[i]<20)cur.pos[i]=gen()%19+1; if(opp.pos[i]>0&&opp.pos[i]<20)opp.pos[i]=gen()%19+1;}}
                    else if(id==15)cur.pos[pa%4]=0; else if(id==16)bomb=pb;
                } else {
                    player_loses(cur, opp, "보유하지 않거나 이미 사용한 스킬 ID 사용");
                }
            } 
            else if (action == "MOVE") {
                int pid, yut_val; 
                if (!(cmd >> pid >> yut_val) || pid < 0 || pid > 3) player_loses(cur, opp, "MOVE 파라미터 오류");
                auto it = find(yut_pool.begin(), yut_pool.end(), yut_val);
                if (it == yut_pool.end()) player_loses(cur, opp, "보유하지 않은 윷 수치 사용");
                if (cur.pos[pid] == 0) player_loses(cur, opp, "이미 골인한 말 조작 시도");

                yut_pool.erase(it);
                int u = cur.pos[pid], start_pos = u;
                vector<int> stacked; for(int i=0;i<4;i++) if(cur.pos[i]==u && u != -1) stacked.push_back(i);
                if (stacked.empty()) stacked.push_back(pid);

                if (u == -1 && yut_val < 0) {
                    // 대기 상태에서 빽도 불가 -> 그대로 유지
                } else {
                    if (yut_val > 0) for(int i=0;i<yut_val;i++) u = get_next(u, i==0);
                    else if (yut_val < 0) for(int i=0;i<-yut_val;i++) u = get_prev(u);

                    if (bomb > 0 && ((yut_val>0 && start_pos<=bomb && u>=bomb) || (yut_val<0 && start_pos>=bomb && u<=bomb))) {
                        cout << "💣 지뢰 폭발! 대기실 귀환!\n";
                        u = -1; bomb = 0;
                    }
                }
                for (int i : stacked) cur.pos[i] = u;

                if (u > 0 && u < 20) {
                    bool caught = false;
                    for(int i=0;i<4;i++) if(opp.pos[i]==u) { opp.pos[i]=-1; caught=true; }
                    if (caught) { cout << "⚔️ 상대 말 포획! 윷을 한 번 더 굴릴 수 있습니다!\n"; can_roll = true; }
                }
            } 
            else if (action == "PASS") {
                if (can_roll || !yut_pool.empty()) player_loses(cur, opp, "행동 가능 상태에서 PASS 시도");
                turn_over = true;
            } else { 
                player_loses(cur, opp, "알 수 없는 명령어(" + action + ")");
            }

            if (turn_over || (!can_roll && yut_pool.empty() && !double_buff && !takeout && !backstep)) break;
        }
        turn++;
    }
    
    cout << "\n=== 최대 턴 도달 무승부 ===\n";
    send_msg(p1, "FINISH"); send_msg(p2, "FINISH");
    kill_bot(p1); kill_bot(p2); return 0;
}